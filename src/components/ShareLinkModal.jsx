// ============================================================
//  ShareLinkModal – erstellt einen öffentlichen Read-Only-Link (J10)
//  Zeigt den fertigen Link mit Kopier-Button und QR-fallback URL.
// ============================================================
import { useState } from 'react';
import { C } from '../lib/utils.js';
import { IcoX } from './Icons.jsx';
import { dataService } from '../lib/dataService.js';

const BASE_PATH = import.meta.env.VITE_BASE_PATH || '/azubiboard/';

export default function ShareLinkModal({ kind, title, data, onClose }) {
  const [ttl,     setTtl]     = useState(30);
  const [link,    setLink]    = useState(null); // { token, url, expires_at }
  const [error,   setError]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied,  setCopied]  = useState(false);

  const create = async () => {
    setError(null); setLoading(true);
    try {
      const res = await dataService.createShareLink({ kind, data, title, ttlDays: ttl });
      const origin = window.location.origin;
      // BrowserRouter — pathname-basiert; basename ist BASE_PATH ohne trailing /
      const url = `${origin}${BASE_PATH}share/${res.token}`;
      setLink({ token: res.token, url, expires_at: res.expires_at });
    } catch (e) {
      setError(e.message || 'Fehler beim Erstellen');
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!link?.url) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <div role="dialog" aria-modal="true"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 9100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div style={{ background: 'var(--c-sf)', border: '1px solid var(--c-bd2)', borderRadius: 12, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,.6)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--c-bd)', display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--c-br)', flex: 1 }}>🔗 Öffentlichen Link teilen</span>
          <button onClick={onClose} aria-label="Schließen"
            style={{ background: 'transparent', border: 'none', color: C.mu, cursor: 'pointer', padding: '0 6px' }}>
            <IcoX size={14} />
          </button>
        </div>

        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!link ? (
            <>
              <div style={{ fontSize: 12, color: C.tx, lineHeight: 1.55 }}>
                Erzeugt einen Read-Only-Link, den du z.B. an IHK, Eltern oder Berufsschule weitergeben kannst.
                Empfänger braucht <strong>kein Konto</strong>. Der Link läuft automatisch ab.
              </div>
              <label style={{ fontSize: 12, color: C.mu, fontWeight: 700 }}>
                Gültigkeit
                <select value={ttl} onChange={e => setTtl(Number(e.target.value))}
                  style={{ display: 'block', marginTop: 5, width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid var(--c-bd2)', background: 'var(--c-sf2)', color: 'var(--c-br)', fontSize: 13 }}>
                  <option value={1}>1 Tag</option>
                  <option value={7}>7 Tage</option>
                  <option value={30}>30 Tage (empfohlen)</option>
                  <option value={90}>90 Tage</option>
                  <option value={365}>1 Jahr</option>
                </select>
              </label>
              {error && (
                <div style={{ padding: 9, background: 'rgba(255,59,48,.08)', border: '1px solid rgba(255,59,48,.35)', borderRadius: 7, fontSize: 11, color: C.cr }}>
                  ⚠ {error}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={onClose} className="btn" style={{ padding: '7px 14px', fontSize: 12 }}>Abbrechen</button>
                <button onClick={create} disabled={loading} className="abtn"
                  style={{ padding: '7px 14px', fontSize: 12, cursor: loading ? 'wait' : 'pointer' }}>
                  {loading ? '⏳ …' : '🔗 Link erzeugen'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-gr)' }}>✓ Link bereit zum Teilen</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={link.url} readOnly onFocus={e => e.target.select()}
                  style={{ flex: 1, padding: '8px 10px', fontSize: 11, fontFamily: C.mono, border: '1px solid var(--c-bd2)', borderRadius: 7, background: 'var(--c-sf2)', color: 'var(--c-tx)' }} />
                <button onClick={copy} className={copied ? 'abtn' : 'btn'} style={{ padding: '7px 12px', fontSize: 11, flexShrink: 0 }}>
                  {copied ? '✓ Kopiert' : '📋 Kopieren'}
                </button>
              </div>
              <div style={{ fontSize: 11, color: C.mu }}>
                Läuft ab: <strong style={{ color: 'var(--c-tx)' }}>{new Date(link.expires_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong>
              </div>
              <div style={{ fontSize: 11, color: C.mu, padding: 9, background: 'rgba(255,149,0,.06)', border: '1px solid rgba(255,149,0,.3)', borderRadius: 7, lineHeight: 1.5 }}>
                ⚠ Jeder mit diesem Link kann die Daten lesen.
                Behandle ihn wie ein Passwort. In der Linkverwaltung kannst du ihn jederzeit widerrufen.
              </div>
              <button onClick={onClose} className="btn" style={{ padding: '7px 14px', fontSize: 12, alignSelf: 'flex-end' }}>Fertig</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
