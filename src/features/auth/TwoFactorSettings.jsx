// ============================================================
//  TwoFactorSettings — 2FA-Verwaltung (K1)
//  Wird in ProfilePage eingehängt. Komplette Setup-, Verify-,
//  Disable-Flows mit QR-Code-Rendering via lazy-loaded `qrcode`.
// ============================================================
import { useEffect, useState } from 'react';
import { C } from '../../lib/utils.js';
import { dataService } from '../../lib/dataService.js';

export default function TwoFactorSettings({ showToast }) {
  const [status,  setStatus]  = useState(null);   // null = loading
  const [stage,   setStage]   = useState('idle'); // idle | setup | verify | disable
  const [secret,  setSecret]  = useState(null);
  const [qrUrl,   setQrUrl]   = useState(null);
  const [code,    setCode]    = useState('');
  const [pw,      setPw]      = useState('');
  const [recovery, setRecovery] = useState(null); // Codes nach erfolgreichem Setup
  const [busy,    setBusy]    = useState(false);
  const [err,     setErr]     = useState(null);

  const reload = async () => {
    setStatus(await dataService.twoFactorStatus());
  };
  useEffect(() => { reload(); }, []);

  const startSetup = async () => {
    setErr(null); setBusy(true);
    try {
      const { secret: s, otpauth_url } = await dataService.twoFactorSetup();
      setSecret(s);
      // qrcode lazy-laden, nur wenn Modal geöffnet wird
      const QR = await import('qrcode');
      const dataUrl = await QR.toDataURL(otpauth_url, { errorCorrectionLevel: 'M', margin: 1, width: 220 });
      setQrUrl(dataUrl);
      setStage('verify');
    } catch (e) {
      setErr(e.message);
    } finally { setBusy(false); }
  };

  const verifySetup = async () => {
    const c = code.replace(/\s/g, '');
    if (!/^\d{6}$/.test(c)) { setErr('6-stelliger Code'); return; }
    setErr(null); setBusy(true);
    try {
      const { recovery_codes } = await dataService.twoFactorVerify(c);
      setRecovery(recovery_codes);
      setStage('idle');
      setCode('');
      showToast?.('✓ 2FA aktiviert');
      await reload();
    } catch (e) {
      setErr(e.message);
    } finally { setBusy(false); }
  };

  const disable2FA = async () => {
    if (!pw) { setErr('Passwort eingeben'); return; }
    setErr(null); setBusy(true);
    try {
      await dataService.twoFactorDisable(pw);
      setStage('idle'); setPw('');
      showToast?.('✓ 2FA deaktiviert');
      await reload();
    } catch (e) {
      setErr(e.message);
    } finally { setBusy(false); }
  };

  // ── UI-Helper ───────────────────────────────────────────────
  if (status === null) {
    return <div style={{ fontSize: 12, color: C.mu, padding: 10 }}>Lädt …</div>;
  }

  // Erfolgreiche Aktivierung → Recovery-Codes EINMALIG zeigen
  if (recovery) {
    return (
      <div style={{ padding: 14, background: C.sf2, border: `1px solid ${C.gr}55`, borderRadius: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.gr, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          ✓ 2FA erfolgreich aktiviert
        </div>
        <div style={{ fontSize: 12, color: C.tx, marginBottom: 10, lineHeight: 1.55 }}>
          <strong>Wichtig:</strong> Speichere diese Recovery-Codes JETZT an einem sicheren Ort.
          Sie ersetzen den Authenticator-Code, falls du dein Gerät verlierst.
          Jeder Code funktioniert <strong>nur einmal</strong>.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 5, fontFamily: C.mono, fontSize: 13, color: C.br, marginBottom: 11, padding: 10, background: 'rgba(52,199,89,.06)', borderRadius: 7 }}>
          {recovery.map(c => <div key={c}>● {c}</div>)}
        </div>
        <div style={{ display: 'flex', gap: 7 }}>
          <button onClick={() => {
            navigator.clipboard?.writeText(recovery.join('\n'));
            showToast?.('✓ Codes kopiert');
          }} className="btn" style={{ fontSize: 11 }}>📋 Kopieren</button>
          <button onClick={() => {
            const blob = new Blob([
              `AzubiBoard 2FA Recovery Codes\nErstellt: ${new Date().toLocaleString('de-DE')}\n\n` + recovery.join('\n'),
            ], { type: 'text/plain' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'azubiboard-recovery-codes.txt';
            a.click();
            URL.revokeObjectURL(a.href);
          }} className="btn" style={{ fontSize: 11 }}>⬇ Als Datei</button>
          <button onClick={() => setRecovery(null)} className="abtn" style={{ fontSize: 11, marginLeft: 'auto' }}>Verstanden</button>
        </div>
      </div>
    );
  }

  // 2FA-Setup-Flow
  if (stage === 'verify') {
    return (
      <div style={{ padding: 14, background: C.sf2, border: `1px solid ${C.bd2}`, borderRadius: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.br, marginBottom: 10 }}>2FA einrichten</div>
        <div style={{ fontSize: 11, color: C.mu, marginBottom: 12, lineHeight: 1.55 }}>
          1. Authenticator-App öffnen (Google Authenticator, Authy, 1Password, …)<br/>
          2. QR-Code scannen oder Secret manuell eingeben<br/>
          3. 6-stelligen Code unten eingeben und bestätigen
        </div>
        {qrUrl && (
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
            <img src={qrUrl} alt="2FA QR-Code" style={{ width: 160, height: 160, background: '#fff', padding: 6, borderRadius: 6, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 10, color: C.mu, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>Secret (manuell):</div>
              <code style={{ display: 'block', fontFamily: C.mono, fontSize: 11, padding: '7px 10px', background: C.sf, border: `1px solid ${C.bd}`, borderRadius: 6, color: C.br, wordBreak: 'break-all' }}>
                {secret?.match(/.{1,4}/g)?.join(' ')}
              </code>
            </div>
          </div>
        )}
        <input value={code} onChange={e => setCode(e.target.value)} placeholder="123456" maxLength={10}
          inputMode="numeric" autoComplete="one-time-code"
          style={{ width: '100%', padding: '10px 14px', fontSize: 17, letterSpacing: 4, textAlign: 'center', fontFamily: C.mono, border: `1px solid ${C.bd2}`, borderRadius: 7, background: C.sf, color: C.br, marginBottom: 10, boxSizing: 'border-box' }} />
        {err && <div style={{ fontSize: 11, color: C.cr, marginBottom: 8 }}>⚠ {err}</div>}
        <div style={{ display: 'flex', gap: 7, justifyContent: 'flex-end' }}>
          <button onClick={() => { setStage('idle'); setSecret(null); setQrUrl(null); setCode(''); setErr(null); }} className="btn" style={{ fontSize: 11 }} disabled={busy}>Abbrechen</button>
          <button onClick={verifySetup} className="abtn" style={{ fontSize: 11 }} disabled={busy}>
            {busy ? '⏳ …' : '✓ Aktivieren'}
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'disable') {
    return (
      <div style={{ padding: 14, background: C.sf2, border: `1px solid ${C.cr}45`, borderRadius: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.br, marginBottom: 8 }}>2FA deaktivieren</div>
        <div style={{ fontSize: 11, color: C.mu, marginBottom: 10 }}>
          Passwort zur Bestätigung erforderlich.
        </div>
        <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Passwort" autoComplete="current-password"
          style={{ width: '100%', padding: '10px 14px', fontSize: 13, border: `1px solid ${C.bd2}`, borderRadius: 7, background: C.sf, color: C.br, marginBottom: 10, boxSizing: 'border-box' }} />
        {err && <div style={{ fontSize: 11, color: C.cr, marginBottom: 8 }}>⚠ {err}</div>}
        <div style={{ display: 'flex', gap: 7, justifyContent: 'flex-end' }}>
          <button onClick={() => { setStage('idle'); setPw(''); setErr(null); }} className="btn" style={{ fontSize: 11 }} disabled={busy}>Abbrechen</button>
          <button onClick={disable2FA} disabled={busy}
            style={{ fontSize: 11, padding: '6px 12px', border: `1px solid ${C.cr}`, background: C.cr, color: '#fff', borderRadius: 7, cursor: 'pointer', fontWeight: 700 }}>
            {busy ? '⏳ …' : '🔓 Deaktivieren'}
          </button>
        </div>
      </div>
    );
  }

  // idle: Status anzeigen
  return (
    <div style={{ padding: 14, background: C.sf2, border: `1px solid ${status.enabled ? C.gr + '45' : C.bd2}`, borderRadius: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
        <span style={{ fontSize: 20 }}>{status.enabled ? '🔒' : '🔓'}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.br }}>2-Faktor-Authentifizierung</div>
          <div style={{ fontSize: 11, color: C.mu, marginTop: 2 }}>
            {status.enabled
              ? `Aktiv seit ${status.activated_at ? new Date(status.activated_at).toLocaleDateString('de-DE') : 'unbekannt'}`
              : 'Nicht aktiv — empfohlen für Ausbilder-Accounts'}
          </div>
        </div>
        <span style={{ fontSize: 10, color: status.enabled ? C.gr : C.mu, fontWeight: 700, textTransform: 'uppercase' }}>
          ● {status.enabled ? 'AN' : 'AUS'}
        </span>
      </div>
      {err && <div style={{ fontSize: 11, color: C.cr, marginBottom: 8 }}>⚠ {err}</div>}
      <div style={{ display: 'flex', gap: 7 }}>
        {!status.enabled && (
          <button onClick={startSetup} className="abtn" style={{ fontSize: 11 }} disabled={busy}>
            {busy ? '⏳ …' : '🔐 2FA aktivieren'}
          </button>
        )}
        {status.enabled && (
          <button onClick={() => setStage('disable')} className="btn"
            style={{ fontSize: 11, color: C.cr, borderColor: C.cr + '55' }}>
            Deaktivieren …
          </button>
        )}
      </div>
    </div>
  );
}
