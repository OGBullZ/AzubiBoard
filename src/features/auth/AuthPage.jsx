import { useState } from "react";
import { C, uid, saveSession } from '../../lib/utils.js';
import { hashPassword, isHashed } from '../../lib/crypto.js';
import { dataService } from '../../lib/dataService.js';
import { setToken } from '../../lib/auth.js';

const USE_API = import.meta.env.VITE_USE_API === 'true';

export default function AuthPage({ onLogin, users, onRegister }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault(); setErr('');
    if (!email.trim() || !pw.trim()) { setErr('Bitte alle Felder ausfüllen.'); return; }
    setLoading(true);
    try {
      if (USE_API) {
        // ── API-Modus: bcrypt via PHP ────────────────────────
        const { token, user } = await dataService.login(email.trim(), pw);
        setToken(token);
        onLogin(user);
      } else {
        // ── Lokaler Modus: SHA-256 (Entwicklung) ────────────
        const u = users.find(x => x.email.toLowerCase() === email.toLowerCase());
        if (!u) { setErr('E-Mail oder Passwort falsch.'); setLoading(false); return; }
        const inputHash = await hashPassword(pw);
        const match = isHashed(u.password) ? inputHash === u.password : pw === u.password;
        if (match) { saveSession(u.id); onLogin(u); }
        else { setErr('E-Mail oder Passwort falsch.'); setLoading(false); }
      }
    } catch (err) {
      setErr(err.message || 'Anmeldung fehlgeschlagen. Bitte erneut versuchen.');
      setLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault(); setErr('');
    if (!name.trim()) { setErr('Bitte Namen eingeben.'); return; }
    if (!email.trim()) { setErr('Bitte E-Mail eingeben.'); return; }
    if (!pw.trim() || pw.length < 6) { setErr('Passwort muss mindestens 6 Zeichen haben.'); return; }
    setLoading(true);
    try {
      if (USE_API) {
        // ── API-Modus ────────────────────────────────────────
        const { token, user } = await dataService.register(name.trim(), email.trim(), pw);
        setToken(token);
        // onRegister statt onLogin: fügt Nutzer auch zum Blob hinzu
        // (wichtig für Aufgabenzuweisungen etc.)
        onRegister({ ...user, id: String(user.id) });
      } else {
        // ── Lokaler Modus ────────────────────────────────────
        if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
          setErr('Diese E-Mail ist bereits registriert.'); setLoading(false); return;
        }
        const hashed = await hashPassword(pw);
        const newUser = { id: uid(), name: name.trim(), email: email.trim(), password: hashed, role: 'azubi' };
        saveSession(newUser.id);
        onRegister(newUser);
      }
    } catch (err) {
      setErr(err.message || 'Registrierung fehlgeschlagen. Bitte erneut versuchen.');
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '15%', left: '20%', width: 400, height: 400, borderRadius: '50%', background: `radial-gradient(circle, ${C.ac}0a 0%, transparent 70%)` }} />
        <div style={{ position: 'absolute', bottom: '20%', right: '20%', width: 350, height: 350, borderRadius: '50%', background: `radial-gradient(circle, #2563eb0a 0%, transparent 70%)` }} />
      </div>

      <div style={{ width: '100%', maxWidth: 380, animation: 'fadeUp .3s ease', position: 'relative' }}>
        <header style={{ textAlign: 'center', marginBottom: 28 }}>
          <div aria-hidden="true" style={{ width: 52, height: 52, borderRadius: 15, background: `linear-gradient(135deg, ${C.ac}, #2563eb)`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 12, boxShadow: `0 8px 32px ${C.ac}30` }}>A</div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: C.br, letterSpacing: -.5, margin: 0 }}>AzubiBoard</h1>
          <p style={{ fontSize: 14, color: C.mu, marginTop: 4 }}>Projektmanagement für Auszubildende</p>
        </header>

        <div style={{ background: C.sf, border: `1px solid ${C.bd2}`, borderRadius: 14, padding: 26, boxShadow: '0 8px 40px rgba(0,0,0,.4)' }}>
          <div role="tablist" style={{ display: 'flex', background: C.sf2, borderRadius: 8, padding: 3, marginBottom: 22, gap: 3 }}>
            {[['login', 'Anmelden'], ['register', 'Registrieren']].map(([m, l]) => (
              <button key={m} role="tab" aria-selected={mode === m}
                onClick={() => { setMode(m); setErr(''); }}
                style={{ flex: 1, padding: '8px', borderRadius: 6, fontSize: 13, fontWeight: 700, border: 'none', background: mode === m ? C.ac : 'transparent', color: mode === m ? '#fff' : C.mu, transition: 'all .15s', letterSpacing: .3 }}>
                {l}
              </button>
            ))}
          </div>

          <form onSubmit={mode === 'login' ? handleLogin : handleRegister} noValidate>
            {mode === 'register' && (
              <div style={{ marginBottom: 16 }}>
                <label htmlFor="reg-name" style={{ fontSize: 12, fontWeight: 600, color: C.mu, textTransform: 'uppercase', letterSpacing: 0.3, display: 'block', marginBottom: 8 }}>Vollständiger Name</label>
                <input id="reg-name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Max Mustermann" autoComplete="name" autoFocus style={{ width: '100%', padding: '12px 16px', fontSize: 13, border: `1px solid ${C.bd2}`, borderRadius: 8, background: C.sf, color: C.tx, fontFamily: 'inherit', transition: 'border .2s', boxSizing: 'border-box' }} onFocus={e => e.target.style.borderColor = C.ac} onBlur={e => e.target.style.borderColor = C.bd2} />
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="auth-email" style={{ fontSize: 12, fontWeight: 600, color: C.mu, textTransform: 'uppercase', letterSpacing: 0.3, display: 'block', marginBottom: 8 }}>E-Mail-Adresse</label>
              <input id="auth-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@firma.de" autoComplete="email" autoFocus={mode === 'login'} style={{ width: '100%', padding: '12px 16px', fontSize: 13, border: `1px solid ${C.bd2}`, borderRadius: 8, background: C.sf, color: C.tx, fontFamily: 'inherit', transition: 'border .2s', boxSizing: 'border-box' }} onFocus={e => e.target.style.borderColor = C.ac} onBlur={e => e.target.style.borderColor = C.bd2} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label htmlFor="auth-pw" style={{ fontSize: 12, fontWeight: 600, color: C.mu, textTransform: 'uppercase', letterSpacing: 0.3, display: 'block', marginBottom: 8 }}>Passwort</label>
              <input id="auth-pw" type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} style={{ width: '100%', padding: '12px 16px', fontSize: 13, border: `1px solid ${C.bd2}`, borderRadius: 8, background: C.sf, color: C.tx, fontFamily: 'inherit', transition: 'border .2s', boxSizing: 'border-box' }} onFocus={e => e.target.style.borderColor = C.ac} onBlur={e => e.target.style.borderColor = C.bd2} />
              {mode === 'register' && <div style={{ fontSize: 11, color: C.mu, marginTop: 4 }}>Mindestens 6 Zeichen</div>}
            </div>

            {err && (
              <div role="alert" style={{ fontSize: 13, color: C.cr, background: C.crd, border: `1px solid ${C.cr}35`, borderRadius: 7, padding: '9px 12px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 7 }}>
                <span aria-hidden="true">⚠</span> {err}
              </div>
            )}

            <button type="submit" className="abtn" disabled={loading}
              style={{ width: '100%', padding: '13px', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {loading
                ? <span style={{ width: 16, height: 16, border: '2px solid #fff4', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .6s linear infinite', display: 'inline-block' }} />
                : mode === 'login' ? 'Anmelden' : 'Konto erstellen'}
            </button>
          </form>

          <div style={{ marginTop: 16, padding: '11px 14px', background: C.sf2, borderRadius: 8, fontSize: 12, color: C.mu, borderLeft: `3px solid ${C.ac}` }}>
            <div style={{ fontWeight: 700, marginBottom: 9, color: C.tx, fontSize: 12 }}>Demo — Schnellzugang</div>
            <div style={{ display: 'flex', gap: 7 }}>
              {[
                { label: 'Ausbilder', email: 'ausbilder@firma.de' },
                { label: 'Azubi',     email: 'anna@azubi.de'      },
              ].map(({ label, email: demoEmail }) => (
                <button key={label} type="button"
                  onClick={() => { setMode('login'); setEmail(demoEmail); setPw('1234'); setErr(''); }}
                  style={{ flex: 1, padding: '7px 6px', borderRadius: 6, border: `1px solid ${C.bd2}`, background: C.sf, color: C.tx, fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'border-color .15s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = C.ac}
                  onMouseLeave={e => e.currentTarget.style.borderColor = C.bd2}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
