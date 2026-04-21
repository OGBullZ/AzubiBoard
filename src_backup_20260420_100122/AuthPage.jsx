import { useState } from "react";
import { C, uid } from './utils.js';

export default function AuthPage({ onLogin, users, onRegister }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  function handleLogin(e) {
    e.preventDefault(); setErr('');
    if (!email.trim() || !pw.trim()) { setErr('Bitte alle Felder ausfüllen.'); return; }
    setLoading(true);
    setTimeout(() => {
      const u = users.find(x => x.email.toLowerCase() === email.toLowerCase() && x.password === pw);
      if (u) onLogin(u.id);
      else { setErr('E-Mail oder Passwort falsch.'); setLoading(false); }
    }, 300);
  }

  function handleRegister(e) {
    e.preventDefault(); setErr('');
    if (!name.trim()) { setErr('Bitte Namen eingeben.'); return; }
    if (!email.trim()) { setErr('Bitte E-Mail eingeben.'); return; }
    if (!pw.trim() || pw.length < 4) { setErr('Passwort muss mindestens 4 Zeichen haben.'); return; }
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) { setErr('Diese E-Mail ist bereits registriert.'); return; }
    setLoading(true);
    setTimeout(() => {
      onRegister({ id: uid(), name: name.trim(), email: email.trim(), password: pw, role: 'azubi' });
    }, 300);
  }

  return (
    <main style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      {/* Decorative background */}
      <div aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '15%', left: '20%', width: 400, height: 400, borderRadius: '50%', background: `radial-gradient(circle, ${C.ac}0a 0%, transparent 70%)` }} />
        <div style={{ position: 'absolute', bottom: '20%', right: '20%', width: 350, height: 350, borderRadius: '50%', background: `radial-gradient(circle, #2563eb0a 0%, transparent 70%)` }} />
      </div>

      <div style={{ width: '100%', maxWidth: 380, animation: 'fadeUp .3s ease', position: 'relative' }}>
        {/* Logo */}
        <header style={{ textAlign: 'center', marginBottom: 28 }}>
          <div aria-hidden="true" style={{ width: 52, height: 52, borderRadius: 15, background: `linear-gradient(135deg, ${C.ac}, #2563eb)`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 12, boxShadow: `0 8px 32px ${C.ac}30` }}>A</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.br, letterSpacing: -.5, margin: 0 }}>AzubiBoard</h1>
          <p style={{ fontSize: 12, color: C.mu, marginTop: 4 }}>Projektmanagement für Auszubildende</p>
        </header>

        <div style={{ background: C.sf, border: `1px solid ${C.bd2}`, borderRadius: 14, padding: 26, boxShadow: '0 8px 40px rgba(0,0,0,.4)' }}>
          {/* Mode Tabs */}
          <div role="tablist" style={{ display: 'flex', background: C.sf2, borderRadius: 8, padding: 3, marginBottom: 22, gap: 3 }}>
            {[['login', 'Anmelden'], ['register', 'Registrieren']].map(([m, l]) => (
              <button key={m} role="tab" aria-selected={mode === m}
                onClick={() => { setMode(m); setErr(''); }}
                style={{ flex: 1, padding: '8px', borderRadius: 6, fontSize: 12, fontWeight: 700, border: 'none', background: mode === m ? C.ac : 'transparent', color: mode === m ? '#fff' : C.mu, transition: 'all .15s', letterSpacing: .3 }}>
                {l}
              </button>
            ))}
          </div>

          <form onSubmit={mode === 'login' ? handleLogin : handleRegister} noValidate>
            {mode === 'register' && (
              <div style={{ marginBottom: 14 }}>
                <label htmlFor="reg-name">Vollständiger Name</label>
                <input id="reg-name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Max Mustermann" autoComplete="name" autoFocus />
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <label htmlFor="auth-email">E-Mail-Adresse</label>
              <input id="auth-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@firma.de" autoComplete="email" autoFocus={mode === 'login'} />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label htmlFor="auth-pw">Passwort</label>
              <input id="auth-pw" type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            </div>

            {err && (
              <div role="alert" style={{ fontSize: 12, color: C.cr, background: C.crd, border: `1px solid ${C.cr}35`, borderRadius: 7, padding: '9px 12px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
                <span aria-hidden="true">⚠</span> {err}
              </div>
            )}

            <button type="submit" className="abtn" disabled={loading}
              style={{ width: '100%', padding: '11px', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {loading
                ? <span style={{ width: 16, height: 16, border: '2px solid #fff4', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .6s linear infinite', display: 'inline-block' }} />
                : mode === 'login' ? 'Anmelden' : 'Konto erstellen'}
            </button>
          </form>

          {/* Demo hint */}
          <div style={{ marginTop: 16, padding: '10px 12px', background: C.sf2, borderRadius: 8, fontSize: 11, color: C.mu, borderLeft: `3px solid ${C.ac}` }}>
            <div style={{ fontWeight: 700, marginBottom: 5, color: C.tx, fontSize: 11 }}>Demo-Zugänge zum Testen</div>
            <div style={{ marginBottom: 2 }}>
              <span style={{ color: C.mu }}>Ausbilder: </span>
              <span style={{ fontFamily: C.mono, color: C.ac }}>ausbilder@firma.de</span>
              <span style={{ color: C.mu }}> · PW: </span>
              <span style={{ fontFamily: C.mono, color: C.ac }}>1234</span>
            </div>
            <div>
              <span style={{ color: C.mu }}>Azubi: </span>
              <span style={{ fontFamily: C.mono, color: C.ac }}>anna@azubi.de</span>
              <span style={{ color: C.mu }}> · PW: </span>
              <span style={{ fontFamily: C.mono, color: C.ac }}>1234</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
