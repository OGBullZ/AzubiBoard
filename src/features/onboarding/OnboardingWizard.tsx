import { useState } from 'react';
import { createPortal } from 'react-dom';
import { C } from '../../lib/utils.js';
import type { User } from '../../types';

// ── Feature-Karten Konfiguration ──────────────────────────────
const FEATURES = [
  { icon: '📁', title: 'Projekte',    desc: 'Aufgaben verwalten, Deadlines setzen, Azubis zuweisen' },
  { icon: '📝', title: 'Berichte',    desc: 'Wöchentliche Ausbildungsberichte erstellen und einreichen' },
  { icon: '🎓', title: 'Lernportal',  desc: 'Lernpfade, Quiz, Karteikarten & KI-Lernziele' },
  { icon: '📅', title: 'Kalender',    desc: 'Alle Termine und Deadlines auf einen Blick' },
];

const TIPS_AUSBILDER = [
  { icon: '⚡', text: 'Strg+K öffnet die globale Suche – nach Projekten, Aufgaben und Berichten suchen' },
  { icon: '🤖', text: 'Im Lernportal → Lernpfade → KI-Lernziele vorschlagen lassen' },
  { icon: '📊', text: 'Im Dashboard: Alle Azubis auf einen Blick mit Status und ausstehenden Berichten' },
];
const TIPS_AZUBI = [
  { icon: '⚡', text: 'Strg+K öffnet die globale Suche – schnell zu Projekten und Berichten navigieren' },
  { icon: '📝', text: 'Wöchentlich deinen Bericht ausfüllen: Berichte → Neuer Bericht' },
  { icon: '🎓', text: 'Lernpfade deines Ausbilders im Lernportal verfolgen und Lernziele abhaken' },
];

// ── Schritt 1: Willkommen ─────────────────────────────────────
function StepWelcome({ currentUser }: { currentUser: User }) {
  const isAusbilder = currentUser.role === 'ausbilder';
  const hour        = new Date().getHours();
  const greeting    = hour < 12 ? 'Guten Morgen' : hour < 18 ? 'Hallo' : 'Guten Abend';
  const firstName   = currentUser.name?.split(' ')[0] || currentUser.name;

  return (
    <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
      <div style={{ fontSize: 64, marginBottom: 20, lineHeight: 1 }}>
        {isAusbilder ? '🏫' : '🎓'}
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: C.br, margin: '0 0 8px', lineHeight: 1.2 }}>
        {greeting}, {firstName}!
      </h1>
      <div style={{ fontSize: 14, color: C.mu, marginBottom: 28, lineHeight: 1.6 }}>
        Schön, dass du dabei bist. Du bist als{' '}
        <span style={{ color: C.ac, fontWeight: 700 }}>
          {isAusbilder ? 'Ausbilder' : 'Azubi'}
        </span>{' '}
        eingeloggt.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, textAlign: 'left', marginBottom: 4 }}>
        {(isAusbilder
          ? [
              { icon: '📁', label: 'Projekte erstellen', sub: 'Aufgaben zuweisen & verfolgen' },
              { icon: '👥', label: 'Azubis verwalten',   sub: 'Gruppen, Profile, Berichte' },
              { icon: '📋', label: 'Berichte prüfen',    sub: 'Kommentieren & unterschreiben' },
              { icon: '🗺️', label: 'Lernpfade anlegen',  sub: 'Mit KI-Unterstützung' },
            ]
          : [
              { icon: '📁', label: 'Projekte bearbeiten', sub: 'Aufgaben erledigen & updaten' },
              { icon: '📝', label: 'Berichte schreiben',  sub: 'Wöchentliche Ausbildungsberichte' },
              { icon: '🎓', label: 'Lernpfade verfolgen', sub: 'Quiz, Karten, Lernziele' },
              { icon: '📅', label: 'Termine sehen',       sub: 'Deadlines im Kalender' },
            ]
        ).map(item => (
          <div key={item.label} style={{
            display: 'flex', gap: 10, alignItems: 'flex-start',
            padding: '10px 12px', borderRadius: 9,
            background: C.sf2, border: `1px solid ${C.bd}`,
          }}>
            <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{item.icon}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.br, marginBottom: 1 }}>{item.label}</div>
              <div style={{ fontSize: 11, color: C.mu }}>{item.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Schritt 2: Feature-Tour ───────────────────────────────────
function StepFeatures() {
  return (
    <div style={{ padding: '4px 0 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 44, marginBottom: 12, lineHeight: 1 }}>🗺️</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: C.br, margin: '0 0 6px' }}>
          Was dich erwartet
        </h2>
        <div style={{ fontSize: 13, color: C.mu }}>
          AzubiBoard hat alles was du für deine Ausbildung brauchst.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {FEATURES.map(f => (
          <div key={f.title} style={{
            padding: '16px 14px', borderRadius: 10,
            background: C.sf2, border: `1px solid ${C.bd}`,
            transition: 'border-color .15s',
          }}
            onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.borderColor = C.ac; }}
            onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.borderColor = C.bd; }}>
            <div style={{ fontSize: 28, marginBottom: 8, lineHeight: 1 }}>{f.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.br, marginBottom: 4 }}>{f.title}</div>
            <div style={{ fontSize: 11, color: C.mu, lineHeight: 1.5 }}>{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Schritt 3: Schnellstart ───────────────────────────────────
function StepQuickstart({ currentUser }: { currentUser: User }) {
  const isAusbilder = currentUser.role === 'ausbilder';
  const tips        = isAusbilder ? TIPS_AUSBILDER : TIPS_AZUBI;

  return (
    <div style={{ padding: '4px 0 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 44, marginBottom: 12, lineHeight: 1 }}>🚀</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: C.br, margin: '0 0 6px' }}>
          Bereit zum Start!
        </h2>
        <div style={{ fontSize: 13, color: C.mu }}>
          Ein paar Tipps für den Einstieg:
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 8 }}>
        {tips.map((tip, i) => (
          <div key={i} style={{
            display: 'flex', gap: 12, alignItems: 'flex-start',
            padding: '12px 14px', borderRadius: 9,
            background: i === 0 ? C.acd : C.sf2,
            border: `1px solid ${i === 0 ? C.ac + '40' : C.bd}`,
          }}>
            <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>{tip.icon}</span>
            <div style={{ fontSize: 13, color: C.tx, lineHeight: 1.55 }}>{tip.text}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, color: C.mu, textAlign: 'center', marginTop: 16, padding: '8px 12px', background: C.sf3, borderRadius: 7 }}>
        Du kannst diesen Wizard jederzeit über Profil → Onboarding erneut öffnen.
      </div>
    </div>
  );
}

// ── Haupt-Wizard ──────────────────────────────────────────────
type OnboardingWizardProps = {
  currentUser: User;
  onDone: () => void;
  onNewProject?: () => void;
  onFirstReport?: () => void;
};

export default function OnboardingWizard({ currentUser, onDone, onNewProject, onFirstReport }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const steps = [
    { label: 'Willkommen',   component: <StepWelcome    currentUser={currentUser} /> },
    { label: 'Features',     component: <StepFeatures   /> },
    { label: 'Schnellstart', component: <StepQuickstart currentUser={currentUser} /> },
  ];
  const isLast = step === steps.length - 1;

  const wizard = (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
      animation: 'fadeIn .25s ease',
    }}>
      <div style={{
        background: C.sf, border: `1px solid ${C.bd}`,
        borderRadius: 16, width: '100%', maxWidth: 540,
        maxHeight: '90vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,.5)',
        animation: 'fadeUp .25s ease',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px 12px', borderBottom: `1px solid ${C.bd}`, flexShrink: 0,
        }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {steps.map((_, i) => (
              <div key={i} style={{
                width: i === step ? 20 : 7, height: 7, borderRadius: 4,
                background: i === step ? C.ac : i < step ? C.gr : C.bd2,
                transition: 'all .2s',
              }} />
            ))}
          </div>
          <button onClick={onDone}
            style={{ background: 'transparent', border: 'none', color: C.mu, cursor: 'pointer', fontSize: 11, padding: '4px 8px', borderRadius: 5, fontWeight: 600 }}>
            Überspringen
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          <div key={step} style={{ animation: 'fadeUp .2s ease' }}>
            {steps[step].component}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 24px 20px', borderTop: `1px solid ${C.bd}`,
          display: 'flex', gap: 10, flexShrink: 0,
        }}>
          {step > 0 && (
            <button className="btn" onClick={() => setStep(s => s - 1)}
              style={{ padding: '10px 18px' }}>
              ← Zurück
            </button>
          )}
          <div style={{ flex: 1 }} />
          {isLast && currentUser?.role === 'ausbilder' && (
            <button className="btn" onClick={() => { onDone(); onNewProject?.(); }}
              style={{ padding: '10px 18px', color: C.ac, borderColor: C.ac + '60', fontSize: 13 }}>
              + Erstes Projekt
            </button>
          )}
          {isLast && currentUser?.role === 'azubi' && onFirstReport && (
            <button className="btn" onClick={() => { onDone(); onFirstReport(); }}
              style={{ padding: '10px 18px', color: C.ac, borderColor: C.ac + '60', fontSize: 13 }}>
              + Erster Bericht
            </button>
          )}
          <button className="abtn" onClick={isLast ? onDone : () => setStep(s => s + 1)}
            style={{ padding: '10px 24px', fontSize: 14, fontWeight: 700 }}>
            {isLast ? 'Los geht\'s! 🚀' : 'Weiter →'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(wizard, document.body);
}
