import { useState } from 'react';
import { createPortal } from 'react-dom';
import { C } from '../../lib/utils.js';
import { buildNewsCards } from './welcomeNewsData';
import NewsCard from './NewsCard';
import type { User, AppState } from '../../types';

// ── Feature-Karten Konfiguration ──────────────────────────────
const FEATURES = [
  { icon: '📁', title: 'Projekte',    desc: 'Aufgaben verwalten, Deadlines setzen, Azubis zuweisen' },
  { icon: '📝', title: 'Berichte',    desc: 'Wöchentliche Ausbildungsberichte erstellen und einreichen' },
  { icon: '🎓', title: 'Lernportal',  desc: 'Lernpfade, Quiz, Karteikarten & KI-Lernziele' },
  { icon: '📅', title: 'Kalender',    desc: 'Alle Termine und Deadlines auf einen Blick' },
];

const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 11px', borderRadius: 8, background: C.sf2, border: `1px solid ${C.bd}`, color: C.tx, fontSize: 13, boxSizing: 'border-box' };
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: C.mu, textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 6 };

function StepHeading({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 22 }}>
      <div style={{ fontSize: 44, marginBottom: 12, lineHeight: 1 }} aria-hidden="true">{icon}</div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: C.br, margin: '0 0 6px' }}>{title}</h2>
      <div style={{ fontSize: 13, color: C.mu, lineHeight: 1.5 }}>{sub}</div>
    </div>
  );
}

// ── Schritt 1: Willkommen ─────────────────────────────────────
function StepWelcome({ currentUser }: { currentUser: User }) {
  const isAusbilder = currentUser.role === 'ausbilder';
  const isStaff     = isAusbilder || currentUser.role === 'mentor';
  const hour        = new Date().getHours();
  const greeting    = hour < 12 ? 'Guten Morgen' : hour < 18 ? 'Hallo' : 'Guten Abend';
  const firstName   = currentUser.name?.split(' ')[0] || currentUser.name;
  const roleLabel   = isAusbilder ? 'Ausbilder' : currentUser.role === 'mentor' ? 'Mentor' : 'Azubi';

  return (
    <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
      <div style={{ fontSize: 64, marginBottom: 20, lineHeight: 1 }} aria-hidden="true">
        {isStaff ? '🏫' : '🎓'}
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: C.br, margin: '0 0 8px', lineHeight: 1.2 }}>
        {greeting}, {firstName}!
      </h1>
      <div style={{ fontSize: 14, color: C.mu, marginBottom: 28, lineHeight: 1.6 }}>
        Schön, dass du dabei bist. Du bist als{' '}
        <span style={{ color: C.ac, fontWeight: 700 }}>{roleLabel}</span>{' '}
        eingeloggt. In wenigen Schritten bist du startklar.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, textAlign: 'left', marginBottom: 4 }}>
        {(isStaff
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
            <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }} aria-hidden="true">{item.icon}</span>
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

// ── Azubi: Profil vervollständigen ────────────────────────────
function StepProfile({ currentUser, onUpdateProfile }: { currentUser: User; onUpdateProfile: (c: Partial<User>) => void }) {
  const [profession, setProfession] = useState(currentUser.profession || '');
  const [year,       setYear]       = useState(String(currentUser.apprenticeship_year || 1));
  const [phone,      setPhone]      = useState(currentUser.phone || '');
  const [saved,      setSaved]      = useState(false);

  const dirty = profession.trim() !== (currentUser.profession || '') ||
                Number(year) !== (currentUser.apprenticeship_year || 1) ||
                phone.trim() !== (currentUser.phone || '');

  const save = () => {
    onUpdateProfile({
      profession: profession.trim() || undefined,
      apprenticeship_year: Number(year),
      phone: phone.trim() || undefined,
    });
    setSaved(true);
  };

  return (
    <div style={{ padding: '4px 0 12px' }}>
      <StepHeading icon="🧑‍🎓" title="Dein Profil" sub="Beruf & Lehrjahr helfen, dir die passenden Lernziele zu zeigen. Alles optional." />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={labelStyle} htmlFor="ob-prof">Ausbildungsberuf</label>
          <input id="ob-prof" style={inputStyle} value={profession} onChange={e => { setProfession(e.target.value); setSaved(false); }} placeholder="z.B. Fachinformatiker/in" />
        </div>
        <div>
          <label style={labelStyle} htmlFor="ob-year">Lehrjahr</label>
          <select id="ob-year" style={inputStyle} value={year} onChange={e => { setYear(e.target.value); setSaved(false); }}>
            {[1, 2, 3, 4].map(y => <option key={y} value={y}>{y}. Lehrjahr</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle} htmlFor="ob-phone">Telefon <span style={{ textTransform: 'none', fontWeight: 400 }}>(optional)</span></label>
          <input id="ob-phone" style={inputStyle} value={phone} onChange={e => { setPhone(e.target.value); setSaved(false); }} placeholder="für Rückfragen deines Ausbilders" />
        </div>
        <button className="abtn" onClick={save} disabled={saved && !dirty} style={{ padding: '9px 16px', alignSelf: 'flex-start' }}>
          {saved && !dirty ? '✓ Gespeichert' : 'Profil speichern'}
        </button>
        <div style={{ fontSize: 11, color: C.mu }}>Du kannst diesen Schritt überspringen und später im Profil ergänzen.</div>
      </div>
    </div>
  );
}

// ── Azubi: Gruppe beitreten ───────────────────────────────────
function StepJoinGroup({ onJoinGroup }: { onJoinGroup: (code: string) => { ok: boolean; groupName?: string } }) {
  const [code,   setCode]   = useState('');
  const [result, setResult] = useState<{ ok: boolean; groupName?: string } | null>(null);

  const join = () => {
    if (!code.trim()) return;
    setResult(onJoinGroup(code));
  };

  return (
    <div style={{ padding: '4px 0 12px' }}>
      <StepHeading icon="🔑" title="Gruppe beitreten" sub="Dein Ausbilder hat dir vielleicht einen 6-stelligen Beitritts-Code gegeben." />
      <div style={{ display: 'flex', gap: 8 }}>
        <input style={{ ...inputStyle, fontFamily: C.mono, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700 }}
          value={code} maxLength={6}
          onChange={e => { setCode(e.target.value.toUpperCase()); setResult(null); }}
          onKeyDown={e => { if (e.key === 'Enter') join(); }}
          placeholder="ABC234" aria-label="Beitritts-Code" />
        <button className="abtn" onClick={join} disabled={!code.trim()} style={{ padding: '9px 18px', flexShrink: 0 }}>Beitreten</button>
      </div>
      {result && (result.ok
        ? <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: C.gr + '14', border: `1px solid ${C.gr}40`, fontSize: 13, color: C.br }}>
            ✓ Du gehörst jetzt zu: <strong>{result.groupName}</strong>
          </div>
        : <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: C.crd, border: `1px solid ${C.cr}40`, fontSize: 13, color: C.cr }}>
            Dieser Code passt zu keiner Gruppe. Tippfehler? Sonst geht es auch ohne — dein Ausbilder weist dich zu.
          </div>
      )}
      <div style={{ fontSize: 11, color: C.mu, marginTop: 14 }}>Kein Code? Kein Problem — du kannst auch später beitreten.</div>
    </div>
  );
}

// ── Ausbilder: Erste Gruppe anlegen + Code teilen ─────────────
function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard?.writeText(code); setCopied(true); }}
      title="Code kopieren" aria-label={`Code ${code} kopieren`}
      style={{ fontFamily: C.mono, fontSize: 18, fontWeight: 800, letterSpacing: 3, color: C.ac, background: C.acd, border: `1px solid ${C.ac}40`, borderRadius: 9, padding: '10px 18px', cursor: 'pointer' }}>
      {code} {copied ? '✓' : '⧉'}
    </button>
  );
}

function StepCreateGroup({ onCreateGroup, createdCode, setCreatedCode }: { onCreateGroup: (name: string, type: string) => { code: string }; createdCode: string; setCreatedCode: (c: string) => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('team');

  const create = () => {
    if (!name.trim()) return;
    const { code } = onCreateGroup(name, type);
    setCreatedCode(code);
  };

  return (
    <div style={{ padding: '4px 0 12px' }}>
      <StepHeading icon="👥" title="Erste Gruppe anlegen" sub="Gruppen bündeln deine Azubis. Der Beitritts-Code lädt sie selbstständig ein." />
      {createdCode ? (
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '8px 0' }}>
          <div style={{ fontSize: 13, color: C.br, fontWeight: 600 }}>✓ Gruppe angelegt. Teile diesen Code mit deinen Azubis:</div>
          <CopyCode code={createdCode} />
          <div style={{ fontSize: 11, color: C.mu }}>Azubis geben ihn bei der Registrierung oder im Willkommen-Fenster ein.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle} htmlFor="ob-gname">Gruppenname</label>
            <input id="ob-gname" style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="z.B. IT-Azubis 2026" autoFocus />
          </div>
          <div>
            <label style={labelStyle} htmlFor="ob-gtype">Typ</label>
            <select id="ob-gtype" style={inputStyle} value={type} onChange={e => setType(e.target.value)}>
              <option value="team">👥 Team (Projektgruppe)</option>
              <option value="department">🏢 Abteilung / Jahrgang</option>
            </select>
          </div>
          <button className="abtn" onClick={create} disabled={!name.trim()} style={{ padding: '9px 16px', alignSelf: 'flex-start' }}>Gruppe anlegen</button>
          <div style={{ fontSize: 11, color: C.mu }}>Überspringen geht auch — Gruppen kannst du jederzeit unter „Gruppen" anlegen.</div>
        </div>
      )}
    </div>
  );
}

// ── Ausbilder: Ersten Azubi anlegen/einladen ──────────────────
function StepInviteAzubi({ createdCode, navigate, onDone }: { createdCode: string; navigate: (to: string) => void; onDone: () => void }) {
  return (
    <div style={{ padding: '4px 0 12px' }}>
      <StepHeading icon="📨" title="Azubis dazu holen" sub="Zwei Wege — wähle, was dir lieber ist. Beides geht auch später." />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ padding: '14px 16px', borderRadius: 10, background: C.sf2, border: `1px solid ${C.bd}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.br, marginBottom: 6 }}>🔑 Per Code einladen</div>
          {createdCode ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: C.mu }}>Azubis tragen diesen Code bei der Registrierung ein:</span>
              <CopyCode code={createdCode} />
            </div>
          ) : (
            <div style={{ fontSize: 12, color: C.mu }}>Lege im vorigen Schritt eine Gruppe an — dann erscheint hier der Code zum Teilen.</div>
          )}
        </div>
        <div style={{ padding: '14px 16px', borderRadius: 10, background: C.sf2, border: `1px solid ${C.bd}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.br, marginBottom: 6 }}>✍️ Manuell anlegen</div>
          <div style={{ fontSize: 12, color: C.mu, marginBottom: 10 }}>Azubi-Konto direkt selbst erstellen (Name, E-Mail, Passwort).</div>
          <button className="btn" onClick={() => { onDone(); navigate('/users'); }} style={{ padding: '8px 14px', fontSize: 12 }}>
            Zur Azubi-Verwaltung →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Feature-Tour ──────────────────────────────────────────────
function StepFeatures() {
  return (
    <div style={{ padding: '4px 0 16px' }}>
      <StepHeading icon="🗺️" title="Was dich erwartet" sub="AzubiBoard hat alles für die Ausbildung an einem Ort." />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {FEATURES.map(f => (
          <div key={f.title} style={{ padding: '16px 14px', borderRadius: 10, background: C.sf2, border: `1px solid ${C.bd}` }}>
            <div style={{ fontSize: 28, marginBottom: 8, lineHeight: 1 }} aria-hidden="true">{f.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.br, marginBottom: 4 }}>{f.title}</div>
            <div style={{ fontSize: 11, color: C.mu, lineHeight: 1.5 }}>{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Letzter Schritt: News-Vorschau (= Login-Fenster) ──────────
function StepNewsPreview({ currentUser, data, kind }: { currentUser: User; data: AppState | null; kind: 'azubi' | 'staff' }) {
  const cards = buildNewsCards(data, currentUser, null, 0);
  return (
    <div style={{ padding: '4px 0 12px' }}>
      <StepHeading icon="👋" title={kind === 'azubi' ? 'Dein Wochenstart' : 'Dein Überblick'}
        sub="Genau das begrüßt dich ab jetzt bei jedem Login — deine aktuelle Lage auf einen Blick." />
      {cards.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {cards.slice(0, 4).map(c => (
            <NewsCard key={c.key} accent={c.accent} accentBg={c.accentBg} icon={c.icon} label={c.label} title={c.title} sub={c.sub} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '20px 16px', borderRadius: 10, border: `1px solid ${C.gr}25`, background: C.gr + '08' }}>
          <div style={{ fontSize: 28, color: C.gr }} aria-hidden="true">✓</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.gr }}>Alles im grünen Bereich!</div>
          <div style={{ fontSize: 12, color: C.mu, textAlign: 'center' }}>Sobald es offene Punkte gibt, erscheinen sie hier.</div>
        </div>
      )}
      <div style={{ fontSize: 11, color: C.mu, textAlign: 'center', marginTop: 16, padding: '8px 12px', background: C.sf3, borderRadius: 7 }}>
        💡 Dieses Fenster siehst du ab jetzt einmal täglich beim Login.
      </div>
    </div>
  );
}

// ── Haupt-Wizard ──────────────────────────────────────────────
type OnboardingWizardProps = {
  currentUser: User;
  data: AppState | null;
  onDone: () => void;
  onNewProject?: () => void;
  onFirstReport?: () => void;
  onUpdateProfile: (changes: Partial<User>) => void;
  onJoinGroup: (code: string) => { ok: boolean; groupName?: string };
  onCreateGroup: (name: string, type: string) => { code: string };
  navigate: (to: string) => void;
};

export default function OnboardingWizard({
  currentUser, data, onDone, onNewProject, onFirstReport,
  onUpdateProfile, onJoinGroup, onCreateGroup, navigate,
}: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [createdCode, setCreatedCode] = useState('');

  const role = currentUser.role;
  const steps: { label: string; node: React.ReactNode }[] =
    role === 'azubi' ? [
      { label: 'Willkommen', node: <StepWelcome currentUser={currentUser} /> },
      { label: 'Profil',     node: <StepProfile currentUser={currentUser} onUpdateProfile={onUpdateProfile} /> },
      { label: 'Gruppe',     node: <StepJoinGroup onJoinGroup={onJoinGroup} /> },
      { label: 'Features',   node: <StepFeatures /> },
      { label: 'Start',      node: <StepNewsPreview currentUser={currentUser} data={data} kind="azubi" /> },
    ] : role === 'ausbilder' ? [
      { label: 'Willkommen', node: <StepWelcome currentUser={currentUser} /> },
      { label: 'Gruppe',     node: <StepCreateGroup onCreateGroup={onCreateGroup} createdCode={createdCode} setCreatedCode={setCreatedCode} /> },
      { label: 'Azubis',     node: <StepInviteAzubi createdCode={createdCode} navigate={navigate} onDone={onDone} /> },
      { label: 'Features',   node: <StepFeatures /> },
      { label: 'Überblick',  node: <StepNewsPreview currentUser={currentUser} data={data} kind="staff" /> },
    ] : [
      { label: 'Willkommen', node: <StepWelcome currentUser={currentUser} /> },
      { label: 'Features',   node: <StepFeatures /> },
      { label: 'Überblick',  node: <StepNewsPreview currentUser={currentUser} data={data} kind="staff" /> },
    ];

  const isLast = step === steps.length - 1;

  const wizard = (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, animation: 'fadeIn .25s ease',
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px 12px', borderBottom: `1px solid ${C.bd}`, flexShrink: 0 }}>
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
            {steps[step].node}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px 20px', borderTop: `1px solid ${C.bd}`, display: 'flex', gap: 10, flexShrink: 0 }}>
          {step > 0 && (
            <button className="btn" onClick={() => setStep(s => s - 1)} style={{ padding: '10px 18px' }}>← Zurück</button>
          )}
          <div style={{ flex: 1 }} />
          {isLast && role === 'ausbilder' && (
            <button className="btn" onClick={() => { onDone(); onNewProject?.(); }}
              style={{ padding: '10px 18px', color: C.ac, borderColor: C.ac + '60', fontSize: 13 }}>
              + Erstes Projekt
            </button>
          )}
          {isLast && role === 'azubi' && onFirstReport && (
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
