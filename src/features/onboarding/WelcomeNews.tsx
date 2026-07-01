import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { C, getISOWeek, today, sameId, firstName as getFirstName } from '../../lib/utils.js';
import { isMentor } from '../../lib/roles.js';
import { useDialog, useDesign } from '../../lib/hooks.js';
import { Stamp } from '../../components/Stamp.jsx';
import NewsCard from './NewsCard';
import { buildNewsCards } from './welcomeNewsData';
import type { User, AppState, Id, Goal } from '../../types';

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

export default function WelcomeNews({ data, currentUser, onClose, navigate }: WelcomeNewsProps) {
  const ref = useDialog<HTMLDivElement>(onClose);
  const design = useDesign();

  const isStaff = currentUser.role === 'ausbilder' || currentUser.role === 'mentor';
  const mentor = isMentor(currentUser);
  const firstName = getFirstName(currentUser.name);

  // Delta-Persistenz für „X Lernziele bestätigt 🎉" (zuletzt gesehene Anzahl pro User).
  const confKey = `azubiboard_news_confirmed_${currentUser.id}`;
  const goals = useMemo(() => (data?.trainingPlan?.goals || []) as Goal[], [data]);
  const confirmedCount = useMemo(
    () => isStaff ? 0 : goals.filter((g: Goal) => g.progress?.[currentUser.id]?.status === 'confirmed').length,
    [goals, isStaff, currentUser.id]);
  const [lastConfirmedSeen] = useState<number | null>(() => {
    try { const v = localStorage.getItem(confKey); return v == null ? null : Number(v); } catch { return null; }
  });
  // Aktuelle Anzahl als „gesehen" persistieren (nächster Login zeigt nur den neuen Zuwachs).
  useEffect(() => {
    // !data-Guard: vor geladenem Blob wäre confirmedCount fälschlich 0 und würde
    // die Baseline überschreiben (Fake-"N Lernziele bestätigt"-Karte beim nächsten Login).
    if (isStaff || !data) return;
    try { localStorage.setItem(confKey, String(confirmedCount)); } catch { /* noop */ }
  }, [confirmedCount, confKey, isStaff, data]);

  const now = new Date();
  const dateStr = now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  const week = getISOWeek(today()).week;

  const cards = buildNewsCards(data, currentUser, lastConfirmedSeen, confirmedCount);

  const myProjects = (data?.projects || []).filter(p => p.assignees?.some(a => sameId(a, currentUser.id)));
  const azubiEmptyAccount = !isStaff && myProjects.length === 0 && cards.length === 0;

  const nav = (to: string) => { onClose(); navigate(to); };

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
      <div ref={ref} role="dialog" aria-modal="true" aria-label="Willkommen" tabIndex={-1}
        className={design === 'beta' ? 'news-zettel' : undefined}
        style={{
          background: C.sf, border: `1px solid ${C.bd}`,
          borderRadius: design === 'beta' ? 'var(--r-2)' : 16, width: '100%', maxWidth: 540,
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
              {design === 'beta'
                ? <Stamp label={`${now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}${week != null ? ` · KW ${week}` : ''}`} color="blue" seed={dateStr} stamped />
                : <>{dateStr}{week != null && <> · <span style={{ fontFamily: C.mono }}>KW {week}</span></>}</>}
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
              <div className={design === 'beta' ? 'draft-in' : undefined} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {cards.map((c, i) => (
                  <div key={c.key} style={{ ['--i' as string]: i }}>
                    <NewsCard accent={c.accent} accentBg={c.accentBg} icon={c.icon} label={c.label}
                      title={c.title} sub={c.sub} onClick={c.to ? () => nav(c.to as string) : undefined} />
                  </div>
                ))}
              </div>
            </>
          ) : azubiEmptyAccount ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, padding: '24px 16px', borderRadius: 10, border: `1px solid color-mix(in srgb, ${C.ac} 15%, transparent)`, background: C.acd }}>
              <div style={{ fontSize: 28 }} aria-hidden="true">👋</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.br }}>Willkommen zurück, {firstName}!</div>
              <div style={{ fontSize: 13, color: C.mu, textAlign: 'center', lineHeight: 1.6 }}>
                Dein Ausbilder weist dir Projekte zu. Bis dahin kannst du deinen ersten Berichtsheft-Eintrag anlegen.
              </div>
            </div>
          ) : isStaff ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '24px 16px', borderRadius: 10, border: `1px solid color-mix(in srgb, ${C.gr} 15%, transparent)`, background: `color-mix(in srgb, ${C.gr} 3%, transparent)` }}>
              <div style={{ fontSize: 28, color: C.grT }} aria-hidden="true">✓</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.grT }}>Alles unter Kontrolle</div>
              <div style={{ fontSize: 13, color: C.mu, textAlign: 'center', lineHeight: 1.6 }}>
                Keine Berichte zu prüfen — alle Azubis im Plan.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '24px 16px', borderRadius: 10, border: `1px solid color-mix(in srgb, ${C.gr} 15%, transparent)`, background: `color-mix(in srgb, ${C.gr} 3%, transparent)` }}>
              <div style={{ fontSize: 28, color: C.grT }} aria-hidden="true">✓</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.grT }}>Alles im grünen Bereich!</div>
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
