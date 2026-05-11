// ============================================================
//  ConflictDialog – wird gezeigt wenn der Server 409 sendet
//  (jemand anders hat parallel gespeichert).
//
//  Drei Optionen für den User:
//   1. Server-Version übernehmen (eigene Änderung verwerfen)
//   2. Eigene Version forcieren (Server-Version überschreiben)
//   3. Neu laden + manuell entscheiden (App holt Server-State,
//      User muss seine Änderungen erneut vornehmen)
// ============================================================
import { useEffect, useState } from 'react';

function diffSummary(client, server) {
  if (!client || !server) return null;
  const keys = ['projects', 'reports', 'users', 'groups', 'trainingPlan', 'calendarEvents', 'activityLog'];
  const diffs = [];
  for (const k of keys) {
    const cn = Array.isArray(client[k]) ? client[k].length : (client[k] ? 1 : 0);
    const sn = Array.isArray(server[k]) ? server[k].length : (server[k] ? 1 : 0);
    if (cn !== sn) diffs.push({ k, client: cn, server: sn });
  }
  return diffs;
}

export default function ConflictDialog({ payload, onAcceptServer, onForceMine, onReload, onClose }) {
  const [acting, setActing] = useState(false);
  useEffect(() => {
    // Esc schließt Dialog (Default = Server akzeptieren = sicher)
    const onKey = (e) => { if (e.key === 'Escape' && !acting) onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, acting]);

  const diffs = diffSummary(payload.clientSnapshot, payload.serverData);

  const wrap = async (fn) => {
    setActing(true);
    try { await fn(); } finally { setActing(false); }
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="conflict-title"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)',
        zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}>
      <div style={{
        background: 'var(--c-sf)', border: '1px solid var(--c-bd2)',
        borderRadius: 12, maxWidth: 540, width: '100%', maxHeight: '85vh', overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,.6)',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--c-bd)' }}>
          <div id="conflict-title" style={{ fontSize: 15, fontWeight: 800, color: 'var(--c-cr)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span aria-hidden="true">⚠</span> Speicher-Konflikt
          </div>
          <div style={{ fontSize: 12, color: 'var(--c-mu)', marginTop: 4 }}>
            Während du gearbeitet hast, hat jemand anders (anderer Tab oder Nutzer) ebenfalls gespeichert.
          </div>
        </div>

        <div style={{ padding: '14px 20px', fontSize: 12, color: 'var(--c-tx)' }}>
          {diffs && diffs.length > 0 ? (
            <>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Unterschiede:</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ color: 'var(--c-mu)', textTransform: 'uppercase', letterSpacing: .5 }}>
                    <th style={{ textAlign: 'left',  padding: '3px 6px' }}>Bereich</th>
                    <th style={{ textAlign: 'right', padding: '3px 6px' }}>Dein Stand</th>
                    <th style={{ textAlign: 'right', padding: '3px 6px' }}>Server</th>
                  </tr>
                </thead>
                <tbody>
                  {diffs.map(d => (
                    <tr key={d.k}>
                      <td style={{ padding: '3px 6px' }}>{d.k}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', color: 'var(--c-ac)' }}>{d.client}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', color: 'var(--c-yw)' }}>{d.server}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <div style={{ color: 'var(--c-mu)', fontStyle: 'italic' }}>Inhaltliche Unterschiede konnten nicht ermittelt werden.</div>
          )}
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--c-bd)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={() => wrap(onAcceptServer)} disabled={acting}
            style={{
              padding: '9px 12px', borderRadius: 7, border: '1px solid var(--c-yw)',
              background: 'rgba(255,149,0,.08)', color: 'var(--c-yw)', fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'left',
            }}>
            ✓ <strong>Server-Version übernehmen</strong> (empfohlen)<br/>
            <span style={{ fontWeight: 400, color: 'var(--c-mu)', fontSize: 11 }}>Deine ungespeicherten Änderungen gehen verloren.</span>
          </button>

          <button onClick={() => wrap(onForceMine)} disabled={acting}
            style={{
              padding: '9px 12px', borderRadius: 7, border: '1px solid var(--c-cr)',
              background: 'rgba(255,59,48,.08)', color: 'var(--c-cr)', fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'left',
            }}>
            ⚡ <strong>Meine Version erzwingen</strong><br/>
            <span style={{ fontWeight: 400, color: 'var(--c-mu)', fontSize: 11 }}>Server-Änderungen werden überschrieben.</span>
          </button>

          <button onClick={() => wrap(onReload)} disabled={acting}
            style={{
              padding: '9px 12px', borderRadius: 7, border: '1px solid var(--c-bd2)',
              background: 'transparent', color: 'var(--c-tx)', fontSize: 12, fontWeight: 600, cursor: 'pointer', textAlign: 'left',
            }}>
            ↻ Server-State laden und meine Änderungen verwerfen
          </button>
        </div>
      </div>
    </div>
  );
}
