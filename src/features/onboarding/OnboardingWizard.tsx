import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { C } from '../../lib/utils.js';
import { buildNewsCards } from './welcomeNewsData';
import NewsCard from './NewsCard';
import { Stamp } from '../../components/Stamp.jsx';
import { playStamp } from '../../lib/sound.js';
import { ACCENTS, applyAccent, applyThemeChoice, setSoundPref, type ThemeChoice } from '../../lib/prefs.js';
import type { User, AppState, Id } from '../../types';

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

// ── Alle Rollen: Werkbank einrichten (Akzent / Licht / Sound, wirkt live) ──
// Ausweis-Nr deterministisch aus der User-ID (numerisch → gepolstert, sonst Hash)
function badgeNr(id: Id): string {
  const n = Number(id);
  if (Number.isFinite(n)) return String(Math.abs(n) % 10000).padStart(4, '0');
  const s = String(id);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 10000;
  return String(h).padStart(4, '0');
}

// Rollen-Streifen wie auf den Login-Werksausweisen (Ebene 8: Azubi Orange, Ausbilder Grün, Mentor Cyan)
const ROLE_META: Record<string, { stripe: string; label: string }> = {
  azubi:     { stripe: 'var(--c-ac)', label: 'Azubi' },
  ausbilder: { stripe: 'var(--c-gr)', label: 'Ausbilder' },
  mentor:    { stripe: '#3FD2C7',     label: 'Mentor' },
};

function StepWorkbench({ currentUser }: { currentUser: User }) {
  const [accent, setAccent] = useState(() => { try { return localStorage.getItem('azubiboard_accent') || 'orange'; } catch { return 'orange'; } });
  const [theme,  setTheme]  = useState<ThemeChoice>(() => {
    try {
      if (!localStorage.getItem('azubiboard_theme_manual')) return 'system';
      return (localStorage.getItem('azubiboard_theme') as ThemeChoice) || 'dark';
    } catch { return 'system'; }
  });
  const [sound,   setSound]   = useState(() => { try { return localStorage.getItem('azubiboard_sound') === 'on'; } catch { return false; } });
  const [stamped, setStamped] = useState(false);

  // Zeremonie-Dosierung (Anhang C): EIN Stempel, kurz nachdem der Ausweis steht
  useEffect(() => {
    const t = setTimeout(() => { setStamped(true); playStamp(); }, 700);
    return () => clearTimeout(t);
  }, []);

  const pickAccent  = (v: string)      => { setAccent(v); applyAccent(v); };
  const pickTheme   = (v: ThemeChoice) => { setTheme(v); applyThemeChoice(v); };
  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    setSoundPref(next);
    if (next) playStamp(); // sofortiges Probehören
  };

  const role     = ROLE_META[currentUser.role] || ROLE_META.azubi;
  const initials = (currentUser.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div style={{ padding: '4px 0 12px' }}>
      <StepHeading icon="🛠️" title="Deine Werkbank einrichten"
        sub="Alles wirkt sofort hinter diesem Fenster — und bleibt jederzeit im Profil änderbar." />

      {/* Werksausweis — färbt sich live mit der gewählten Lackierung */}
      <div className="ausweis-card" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px 14px 24px', borderRadius: 10, background: C.sf2, border: `1px solid ${C.bd2}`, overflow: 'hidden', marginBottom: 20, boxShadow: 'var(--shadow-xs)' }}>
        <span aria-hidden="true" style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 5, borderRadius: '0 3px 3px 0', background: role.stripe }} />
        <span aria-hidden="true" style={{ position: 'absolute', right: 14, top: 10, width: 8, height: 8, borderRadius: '50%', background: C.bg, border: `1px solid ${C.bd2}` }} />
        <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--c-acd)', color: 'var(--c-ac)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, flexShrink: 0 }}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9, color: C.mu, fontFamily: C.mono, letterSpacing: '.16em', marginBottom: 2 }}>WERKSAUSWEIS · NR. {badgeNr(currentUser.id)}</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.br, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUser.name}</div>
          <div style={{ fontSize: 11, color: C.mu }}>{role.label}</div>
        </div>
        {stamped && <Stamp label="Gültig" color="green" stamped seed={currentUser.id} />}
      </div>

      {/* Lackierung */}
      <div style={{ marginBottom: 16 }}>
        <span style={labelStyle}>Lackierung</span>
        <div style={{ display: 'flex', gap: 10 }} role="radiogroup" aria-label="Akzentfarbe">
          {ACCENTS.map(a => (
            <button key={a.val} type="button" role="radio" aria-checked={accent === a.val} aria-label={a.label} title={a.label}
              onClick={() => pickAccent(a.val)}
              style={{ width: 38, height: 38, borderRadius: 9, background: a.hex, cursor: 'pointer',
                border: accent === a.val ? `2px solid ${C.br}` : '2px solid transparent',
                boxShadow: accent === a.val ? 'inset 0 0 0 2px var(--c-sf)' : 'none' }} />
          ))}
        </div>
      </div>

      {/* Licht */}
      <div style={{ marginBottom: 16 }}>
        <span style={labelStyle}>Licht</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {([['dark', '🌙', 'Werkstatt'], ['light', '📄', 'Papier'], ['system', '🖥️', 'Wie System']] as const).map(([v, ico, lab]) => (
            <button key={v} type="button" className="btn" onClick={() => pickTheme(v)} aria-pressed={theme === v}
              style={{ flex: 1, justifyContent: 'center', padding: '9px 0', fontSize: 12,
                ...(theme === v ? { borderColor: 'var(--c-ac)', color: 'var(--c-ac)', background: 'var(--c-acd)' } : {}) }}>
              {ico} {lab}
            </button>
          ))}
        </div>
      </div>

      {/* Werkstatt-Sounds */}
      <div>
        <span style={labelStyle}>Geräusche</span>
        <button type="button" className="btn" onClick={toggleSound} aria-pressed={sound}
          style={{ width: '100%', justifyContent: 'center', padding: '10px 0', fontSize: 12,
            ...(sound ? { borderColor: 'var(--c-ac)', color: 'var(--c-ac)' } : {}) }}>
          {sound ? '🔊 Werkstatt-Sounds an' : '🔇 Werkstatt-Sounds aus'}
        </button>
        <div style={{ fontSize: 11, color: C.mu, marginTop: 6 }}>Dezenter Stempel-Klack bei Aktionen — standardmäßig aus.</div>
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

// ── Azubi: Gruppe beitreten (per Anfrage) ─────────────────────
function StepRequestGroup({ currentUser, data, onRequestGroup }: { currentUser: User; data: AppState | null; onRequestGroup: (groupId: Id) => void }) {
  const groups = ((data?.groups || []) as { id: Id; name: string; type?: string; members?: Id[]; requests?: Id[] }[]);
  const [requested, setRequested] = useState<Set<Id>>(new Set());

  const send = (id: Id) => { onRequestGroup(id); setRequested(prev => new Set(prev).add(id)); };

  return (
    <div style={{ padding: '4px 0 12px' }}>
      <StepHeading icon="🙋" title="Gruppe beitreten" sub="Schick deinem Ausbilder eine Beitritts-Anfrage — er bestätigt sie dann." />
      {groups.length === 0 ? (
        <div style={{ fontSize: 13, color: C.mu, textAlign: 'center', padding: '16px 0' }}>
          Es gibt noch keine Gruppen. Dein Ausbilder legt sie an und fügt dich hinzu.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {groups.map(g => {
            // String-Vergleich wie GroupsView.sameId — IDs sind je nach Modus string oder number
            const isMember  = (g.members || []).some((m: unknown) => String(m) === String(currentUser.id));
            const isPending = requested.has(g.id) || (g.requests || []).some((r: unknown) => String(r) === String(currentUser.id));
            return (
              <div key={String(g.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, background: C.sf2, border: `1px solid ${C.bd}` }}>
                <span style={{ fontSize: 16 }} aria-hidden="true">{g.type === 'department' ? '🏢' : '👥'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.br }}>{g.name}</div>
                  <div style={{ fontSize: 11, color: C.mu }}>{(g.members || []).length} Mitglied(er)</div>
                </div>
                {isMember
                  ? <span style={{ fontSize: 11, fontWeight: 700, color: C.gr }}>✓ Mitglied</span>
                  : isPending
                    ? <span style={{ fontSize: 11, fontWeight: 700, color: C.ac }}>Anfrage gesendet</span>
                    : <button className="btn" onClick={() => send(g.id)} style={{ fontSize: 11, padding: '6px 12px' }}>Beitritt anfragen</button>}
              </div>
            );
          })}
        </div>
      )}
      <div style={{ fontSize: 11, color: C.mu, marginTop: 14 }}>Kein Treffer? Kein Problem — dein Ausbilder kann dich auch direkt hinzufügen.</div>
    </div>
  );
}

// ── Ausbilder: Erste Gruppe anlegen ───────────────────────────
function StepCreateGroup({ onCreateGroup }: { onCreateGroup: (name: string, type: string) => void }) {
  const [name, setName]   = useState('');
  const [type, setType]   = useState('team');
  const [created, setCreated] = useState<string | null>(null);

  const create = () => {
    if (!name.trim()) return;
    onCreateGroup(name, type);
    setCreated(name.trim());
    setName('');
  };

  return (
    <div style={{ padding: '4px 0 12px' }}>
      <StepHeading icon="👥" title="Erste Gruppe anlegen" sub="Gruppen bündeln deine Azubis. Sie können der Gruppe danach selbst per Anfrage beitreten." />
      {created ? (
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '12px 0' }}>
          <div style={{ fontSize: 28 }} aria-hidden="true">✓</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.br }}>Gruppe „{created}" angelegt</div>
          <div style={{ fontSize: 12, color: C.mu, lineHeight: 1.5, maxWidth: 360 }}>
            Deine Azubis sehen die Gruppe beim Login und können Beitritt anfragen — du bestätigst die Anfragen unter „Gruppen".
          </div>
          <button className="btn" onClick={() => setCreated(null)} style={{ fontSize: 12, padding: '6px 12px' }}>Weitere Gruppe anlegen</button>
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

// ── Ausbilder: Azubis dazu holen ──────────────────────────────
function StepInviteAzubi({ navigate, onDone }: { navigate: (to: string) => void; onDone: () => void }) {
  return (
    <div style={{ padding: '4px 0 12px' }}>
      <StepHeading icon="📨" title="Azubis dazu holen" sub="Zwei Wege — beides geht auch später." />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ padding: '14px 16px', borderRadius: 10, background: C.sf2, border: `1px solid ${C.bd}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.br, marginBottom: 6 }}>🙋 Per Anfrage</div>
          <div style={{ fontSize: 12, color: C.mu, lineHeight: 1.5 }}>
            Azubis registrieren sich selbst und schicken eine Beitritts-Anfrage an deine Gruppe. Du bestätigst sie unter „Gruppen" → offene Anfragen.
          </div>
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '20px 16px', borderRadius: 10, border: `1px solid color-mix(in srgb, ${C.gr} 15%, transparent)`, background: `color-mix(in srgb, ${C.gr} 3%, transparent)` }}>
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
  onRequestGroup: (groupId: Id) => void;
  onCreateGroup: (name: string, type: string) => void;
  navigate: (to: string) => void;
};

export default function OnboardingWizard({
  currentUser, data, onDone, onNewProject, onFirstReport,
  onUpdateProfile, onRequestGroup, onCreateGroup, navigate,
}: OnboardingWizardProps) {
  const [step, setStep] = useState(0);

  const role = currentUser.role;
  const steps: { label: string; node: React.ReactNode }[] =
    role === 'azubi' ? [
      { label: 'Willkommen', node: <StepWelcome currentUser={currentUser} /> },
      { label: 'Werkbank',   node: <StepWorkbench currentUser={currentUser} /> },
      { label: 'Profil',     node: <StepProfile currentUser={currentUser} onUpdateProfile={onUpdateProfile} /> },
      { label: 'Gruppe',     node: <StepRequestGroup currentUser={currentUser} data={data} onRequestGroup={onRequestGroup} /> },
      { label: 'Features',   node: <StepFeatures /> },
      { label: 'Start',      node: <StepNewsPreview currentUser={currentUser} data={data} kind="azubi" /> },
    ] : role === 'ausbilder' ? [
      { label: 'Willkommen', node: <StepWelcome currentUser={currentUser} /> },
      { label: 'Werkbank',   node: <StepWorkbench currentUser={currentUser} /> },
      { label: 'Gruppe',     node: <StepCreateGroup onCreateGroup={onCreateGroup} /> },
      { label: 'Azubis',     node: <StepInviteAzubi navigate={navigate} onDone={onDone} /> },
      { label: 'Features',   node: <StepFeatures /> },
      { label: 'Überblick',  node: <StepNewsPreview currentUser={currentUser} data={data} kind="staff" /> },
    ] : [
      { label: 'Willkommen', node: <StepWelcome currentUser={currentUser} /> },
      { label: 'Werkbank',   node: <StepWorkbench currentUser={currentUser} /> },
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
              style={{ padding: '10px 18px', color: C.ac, borderColor: `color-mix(in srgb, ${C.ac} 38%, transparent)`, fontSize: 13 }}>
              + Erstes Projekt
            </button>
          )}
          {isLast && role === 'azubi' && onFirstReport && (
            <button className="btn" onClick={() => { onDone(); onFirstReport(); }}
              style={{ padding: '10px 18px', color: C.ac, borderColor: `color-mix(in srgb, ${C.ac} 38%, transparent)`, fontSize: 13 }}>
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
