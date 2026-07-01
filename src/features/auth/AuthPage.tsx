import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { C, uid, saveSession } from '../../lib/utils.js';
import { hashPassword, isHashed } from '../../lib/crypto.js';
import { dataService } from '../../lib/dataService.js';
import { setToken } from '../../lib/auth.js';
import type { User } from '../../types';
import { useDesign } from '../../lib/hooks.js';
import { Stamp } from '../../components/Stamp.jsx';

const USE_API = import.meta.env.VITE_USE_API === 'true';

type AuthPageProps = {
  onLogin: (user: User) => void;
  users: User[];
  onRegister: (user: User) => void;
};

type TwoFactorState = { partial_token: string };

export default function AuthPage({ onLogin, users, onRegister }: AuthPageProps) {
  const { t } = useTranslation();
  const design = useDesign();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [name, setName] = useState('');
  // Registrierung Minimal-Setup (Azubi): Beruf + Lehrjahr (Phase 2)
  const [profession, setProfession] = useState('');
  const [apprenticeshipYear, setApprenticeshipYear] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  // K1: 2FA-Stufe nach Passwort-Eingabe
  const [twofa, setTwofa] = useState<TwoFactorState | null>(null);  // { partial_token } oder null
  const [tfCode, setTfCode] = useState('');

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr('');
    if (!email.trim() || !pw.trim()) { setErr(t('auth.allFieldsRequired')); return; }
    setLoading(true);
    try {
      if (USE_API) {
        const res = await dataService.login(email.trim(), pw);
        if (res?.requires_2fa) {
          // K1: zweite Stufe — Code-Input zeigen
          setTwofa({ partial_token: res.partial_token });
          setLoading(false);
          return;
        }
        setToken(res.token);
        // ID als String normalisieren — Blob-User-IDs sind Strings (Bug-Hunt APP-F1)
        onLogin({ ...res.user, id: String(res.user.id) });
      } else {
        // ── Lokaler Modus: SHA-256 (Entwicklung) ────────────
        const u = users.find(x => x.email.toLowerCase() === email.toLowerCase());
        if (!u) { setErr(t('auth.wrongCredentials')); setLoading(false); return; }
        const inputHash = await hashPassword(pw);
        // Lokaler Modus speichert password am User-Objekt (Blob-Form, nicht im API-Schema)
        const stored = (u as { password?: string }).password;
        const match = isHashed(stored) ? inputHash === stored : pw === stored;
        if (match) { saveSession(u.id); onLogin(u); }
        else { setErr(t('auth.wrongCredentials')); setLoading(false); }
      }
    } catch (err) {
      setErr((err as Error).message || t('auth.loginFailed'));
      setLoading(false);
    }
  }

  // K1: 2FA-Code prüfen
  async function handle2FA(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr('');
    const code = tfCode.replace(/\s/g, '');
    if (!code) { setErr(t('auth.enterCode')); return; }
    setLoading(true);
    try {
      const { token, user } = await dataService.twoFactorCheck(twofa!.partial_token, code);
      setToken(token);
      onLogin({ ...user, id: String(user.id) });
    } catch (err) {
      setErr((err as Error).message || t('auth.codeWrong'));
      setTfCode('');
      setLoading(false);
    }
  }

  function cancelTwoFA() {
    setTwofa(null);
    setTfCode('');
    setErr('');
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr('');
    if (!name.trim()) { setErr(t('auth.enterName')); return; }
    if (!email.trim()) { setErr(t('auth.enterEmail')); return; }
    if (!pw.trim() || pw.length < 8) { setErr(t('auth.passwordTooShort')); return; }
    setLoading(true);
    try {
      if (USE_API) {
        // ── API-Modus ────────────────────────────────────────
        const { token, user } = await dataService.register(name.trim(), email.trim(), pw);
        setToken(token);
        // onRegister statt onLogin: fügt Nutzer auch zum Blob hinzu
        // (wichtig für Aufgabenzuweisungen etc.)
        onRegister({ ...user, id: String(user.id), profession: profession.trim() || undefined, apprenticeship_year: apprenticeshipYear ? Number(apprenticeshipYear) : undefined });
      } else {
        // ── Lokaler Modus ────────────────────────────────────
        if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
          setErr(t('auth.alreadyRegistered')); setLoading(false); return;
        }
        const hashed = await hashPassword(pw);
        const newUser = { id: uid(), name: name.trim(), email: email.trim(), password: hashed, role: 'azubi' as const, profession: profession.trim() || undefined, apprenticeship_year: apprenticeshipYear ? Number(apprenticeshipYear) : undefined };
        saveSession(newUser.id);
        onRegister(newUser);
      }
    } catch (err) {
      setErr((err as Error).message || t('auth.registerFailed'));
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '15%', left: '20%', width: 400, height: 400, borderRadius: '50%', background: `radial-gradient(circle, color-mix(in srgb, ${C.ac} 4%, transparent) 0%, transparent 70%)` }} />
        <div style={{ position: 'absolute', bottom: '20%', right: '20%', width: 350, height: 350, borderRadius: '50%', background: `radial-gradient(circle, #2563eb0a 0%, transparent 70%)` }} />
      </div>

      <div style={{ width: '100%', maxWidth: 380, animation: 'fadeUp .3s ease', position: 'relative' }}>
        <header style={{ textAlign: 'center', marginBottom: 28 }}>
          {design === 'beta' ? (
            /* Logo konstruiert sich wie eine technische Zeichnung (Signature 2) */
            <svg className="draw-in" width="68" height="68" viewBox="0 0 64 64" fill="none" aria-hidden="true" style={{ marginBottom: 10 }}>
              <circle cx="32" cy="30" r="26" stroke="var(--c-ac)" strokeWidth="2" />
              <path d="M19 44 L32 14 L45 44" stroke={C.br} strokeWidth="2.5" className="draw-2" />
              <line x1="24.5" y1="34" x2="39.5" y2="34" stroke={C.br} strokeWidth="2.5" className="draw-2" />
              <line x1="8" y1="56" x2="56" y2="56" stroke={C.mu} strokeWidth="1" strokeDasharray="4 4" className="draw-3" opacity=".55" />
            </svg>
          ) : (
            <div aria-hidden="true" style={{ width: 52, height: 52, borderRadius: 15, background: `linear-gradient(135deg, ${C.ac}, #2563eb)`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 12, boxShadow: `0 8px 32px color-mix(in srgb, ${C.ac} 19%, transparent)` }}>A</div>
          )}
          <h1 style={{ fontSize: 32, fontWeight: 800, color: C.br, letterSpacing: -.5, margin: 0 }}>AzubiBoard</h1>
          <p style={{ fontSize: 14, color: C.mu, marginTop: 4 }}>{t('auth.subtitle')}</p>
        </header>

        <div key={design === 'beta' ? `err-${err || 'none'}` : 'card'}
          className={design === 'beta' && err ? 'shake-reject' : undefined}
          style={{ background: C.sf, border: `1px solid ${C.bd2}`, borderRadius: 14, padding: 26, boxShadow: '0 8px 40px rgba(0,0,0,.4)' }}>
          {twofa ? (
            /* K1: 2FA-Stufe — Code-Input */
            <form onSubmit={handle2FA} noValidate>
              <div style={{ marginBottom: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 30, marginBottom: 8 }}>🔐</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.br, marginBottom: 4 }}>{t('auth.twoFactor')}</div>
                <div style={{ fontSize: 12, color: C.mu }}>{t('auth.twoFactorHint')}</div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label htmlFor="tf-code" style={{ fontSize: 12, fontWeight: 600, color: C.mu, textTransform: 'uppercase', letterSpacing: 0.3, display: 'block', marginBottom: 8 }}>
                  {t('auth.twoFactorLabel')}
                </label>
                <input id="tf-code" type="text" inputMode="numeric" autoComplete="one-time-code"
                  value={tfCode}
                  onChange={e => setTfCode(e.target.value)}
                  placeholder="123 456"
                  autoFocus
                  maxLength={20}
                  style={{ width: '100%', padding: '12px 16px', fontSize: 18, letterSpacing: 4, textAlign: 'center', fontFamily: C.mono, border: `1px solid ${C.bd2}`, borderRadius: 8, background: C.sf, color: C.br, boxSizing: 'border-box' }} />
              </div>
              {err && (
                <div role="alert" style={{ fontSize: 13, color: C.crT, background: C.crd, border: `1px solid color-mix(in srgb, ${C.cr} 21%, transparent)`, borderRadius: 7, padding: '9px 12px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span aria-hidden="true">⚠</span> {err}
                </div>
              )}
              <button type="submit" className="abtn" disabled={loading}
                style={{ width: '100%', padding: '13px', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 9 }}>
                {loading
                  ? <span style={{ width: 16, height: 16, border: '2px solid #fff4', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .6s linear infinite', display: 'inline-block' }} />
                  : t('common.confirm')}
              </button>
              <button type="button" onClick={cancelTwoFA}
                style={{ width: '100%', padding: '9px', fontSize: 12, background: 'transparent', border: 'none', color: C.mu, cursor: 'pointer' }}>
                {t('auth.backToLogin')}
              </button>
            </form>
          ) : (
          <>
          <div role="tablist" style={{ display: 'flex', background: C.sf2, borderRadius: 8, padding: 3, marginBottom: 22, gap: 3 }}>
            {([['login', t('auth.login')], ['register', t('auth.register')]] as const).map(([m, l]) => (
              <button key={m} role="tab" aria-selected={mode === m}
                onClick={() => { setMode(m); setErr(''); }}
                style={{ flex: 1, padding: '8px', borderRadius: 6, fontSize: 13, fontWeight: 700, border: 'none', background: mode === m ? C.ac : 'transparent', color: mode === m ? C.onAc : C.mu, transition: 'all .15s', letterSpacing: .3 }}>
                {l}
              </button>
            ))}
          </div>

          <form onSubmit={mode === 'login' ? handleLogin : handleRegister} noValidate>
            {mode === 'register' && (
              <div style={{ marginBottom: 16 }}>
                <label htmlFor="reg-name" style={{ fontSize: 12, fontWeight: 600, color: C.mu, textTransform: 'uppercase', letterSpacing: 0.3, display: 'block', marginBottom: 8 }}>{t('auth.fullName')}</label>
                <input id="reg-name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Max Mustermann" autoComplete="name" autoFocus style={{ width: '100%', padding: '12px 16px', fontSize: 13, border: `1px solid ${C.bd2}`, borderRadius: 8, background: C.sf, color: C.tx, fontFamily: 'inherit', transition: 'border .2s', boxSizing: 'border-box' }} onFocus={e => e.target.style.borderColor = C.ac} onBlur={e => e.target.style.borderColor = C.bd2} />
              </div>
            )}
            {mode === 'register' && (
              <div style={{ marginBottom: 16, display: 'flex', gap: 10 }}>
                <div style={{ flex: 2, minWidth: 0 }}>
                  <label htmlFor="reg-prof" style={{ fontSize: 12, fontWeight: 600, color: C.mu, textTransform: 'uppercase', letterSpacing: 0.3, display: 'block', marginBottom: 8 }}>Beruf <span style={{ textTransform: 'none', fontWeight: 400 }}>(optional)</span></label>
                  <input id="reg-prof" type="text" value={profession} onChange={e => setProfession(e.target.value)} placeholder="z.B. Fachinformatiker/in" style={{ width: '100%', padding: '12px 16px', fontSize: 13, border: `1px solid ${C.bd2}`, borderRadius: 8, background: C.sf, color: C.tx, fontFamily: 'inherit', transition: 'border .2s', boxSizing: 'border-box' }} onFocus={e => e.target.style.borderColor = C.ac} onBlur={e => e.target.style.borderColor = C.bd2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label htmlFor="reg-year" style={{ fontSize: 12, fontWeight: 600, color: C.mu, textTransform: 'uppercase', letterSpacing: 0.3, display: 'block', marginBottom: 8 }}>Lehrjahr</label>
                  <select id="reg-year" value={apprenticeshipYear} onChange={e => setApprenticeshipYear(e.target.value)} style={{ width: '100%', padding: '12px 16px', fontSize: 13, border: `1px solid ${C.bd2}`, borderRadius: 8, background: C.sf, color: C.tx, fontFamily: 'inherit', boxSizing: 'border-box' }}>
                    <option value="">–</option>
                    <option value="1">1. Lehrjahr</option>
                    <option value="2">2. Lehrjahr</option>
                    <option value="3">3. Lehrjahr</option>
                    <option value="4">4. Lehrjahr</option>
                  </select>
                </div>
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="auth-email" style={{ fontSize: 12, fontWeight: 600, color: C.mu, textTransform: 'uppercase', letterSpacing: 0.3, display: 'block', marginBottom: 8 }}>{t('auth.emailAddress')}</label>
              <input id="auth-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@firma.de" autoComplete="email" autoFocus={mode === 'login'} style={{ width: '100%', padding: '12px 16px', fontSize: 13, border: `1px solid ${C.bd2}`, borderRadius: 8, background: C.sf, color: C.tx, fontFamily: 'inherit', transition: 'border .2s', boxSizing: 'border-box' }} onFocus={e => e.target.style.borderColor = C.ac} onBlur={e => e.target.style.borderColor = C.bd2} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label htmlFor="auth-pw" style={{ fontSize: 12, fontWeight: 600, color: C.mu, textTransform: 'uppercase', letterSpacing: 0.3, display: 'block', marginBottom: 8 }}>{t('auth.password')}</label>
              <input id="auth-pw" type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} style={{ width: '100%', padding: '12px 16px', fontSize: 13, border: `1px solid ${C.bd2}`, borderRadius: 8, background: C.sf, color: C.tx, fontFamily: 'inherit', transition: 'border .2s', boxSizing: 'border-box' }} onFocus={e => e.target.style.borderColor = C.ac} onBlur={e => e.target.style.borderColor = C.bd2} />
              {mode === 'register' && <div style={{ fontSize: 11, color: C.mu, marginTop: 4 }}>{t('auth.passwordHint')}</div>}
            </div>

            {err && (
              <div role="alert" style={{ fontSize: 13, color: C.crT, background: C.crd, border: `1px solid color-mix(in srgb, ${C.cr} 21%, transparent)`, borderRadius: 7, padding: '9px 12px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 7 }}>
                <span aria-hidden="true">⚠</span> <span style={{ flex: 1 }}>{err}</span>
                {design === 'beta' && mode === 'login' && <Stamp label="Abgelehnt" color="red" stamped seed={err} />}
              </div>
            )}

            <button type="submit" className="abtn" disabled={loading}
              style={{ width: '100%', padding: '13px', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {loading
                ? <span style={{ width: 16, height: 16, border: '2px solid #fff4', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .6s linear infinite', display: 'inline-block' }} />
                : mode === 'login' ? t('auth.login') : t('auth.createAccount')}
            </button>
          </form>

          <div style={{ marginTop: 16, padding: '11px 14px', background: C.sf2, borderRadius: 8, fontSize: 12, color: C.mu, borderLeft: `3px solid ${C.ac}` }}>
            <div style={{ fontWeight: 700, marginBottom: 9, color: C.tx, fontSize: 12 }}>{t('auth.demoQuickAccess')}</div>
            <div style={{ display: 'flex', gap: 7 }}>
              {[
                { label: t('auth.trainer'), email: 'ausbilder@firma.de', stripe: C.gr, nr: '0001' },
                { label: t('auth.apprentice'), email: 'anna@azubi.de', stripe: C.ac, nr: '0042' },
              ].map(({ label, email: demoEmail, stripe, nr }) => (
                <button key={label} type="button"
                  onClick={() => { setMode('login'); setEmail(demoEmail); setPw('1234'); setErr(''); }}
                  style={design === 'beta'
                    /* Werksausweis: Rollen-Farbstreifen + Lochung + Mono-Nr (Ebene 8) */
                    ? { flex: 1, position: 'relative', padding: '10px 8px 8px 14px', borderRadius: 'var(--r-2)', border: `1px solid ${C.bd2}`, background: C.sf, color: C.tx, fontSize: 11, fontWeight: 600, cursor: 'pointer', textAlign: 'left', overflow: 'hidden', boxShadow: 'var(--shadow-xs)' }
                    : { flex: 1, padding: '7px 6px', borderRadius: 6, border: `1px solid ${C.bd2}`, background: C.sf, color: C.tx, fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'border-color .15s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = C.ac}
                  onMouseLeave={e => e.currentTarget.style.borderColor = C.bd2}>
                  {design === 'beta' && <span aria-hidden="true" style={{ position: 'absolute', left: 0, top: 6, bottom: 6, width: 4, borderRadius: '0 3px 3px 0', background: stripe }} />}
                  {label}
                  {design === 'beta' && <div style={{ fontFamily: C.mono, fontSize: 9, color: C.mu, letterSpacing: '.12em', marginTop: 2 }}>#{nr}</div>}
                </button>
              ))}
            </div>
          </div>
          </>
          )}
        </div>
      </div>
    </main>
  );
}
