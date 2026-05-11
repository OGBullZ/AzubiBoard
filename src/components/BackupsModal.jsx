// ============================================================
//  BackupsModal — Server-Backups verwalten (L4)
//  Ausbilder-only: listet tägliche Snapshots, kann sie als JSON
//  herunterladen oder als aktuellen Stand wiederherstellen.
// ============================================================
import { useEffect, useState } from 'react';
import { C, fmtDate } from '../lib/utils.js';
import { dataService } from '../lib/dataService.js';
import { IcoX } from './Icons.jsx';

function fmtBytes(b) {
  if (!b) return '–';
  if (b < 1024)         return `${b} B`;
  if (b < 1024 * 1024)  return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

export default function BackupsModal({ onClose, onRestore, showToast }) {
  const [backups, setBackups] = useState(null);          // null = loading
  const [confirm, setConfirm] = useState(null);          // day für Restore-Confirm
  const [acting,  setActing]  = useState(false);

  const load = async () => {
    try {
      const list = await dataService.listBackups();
      setBackups(list);
    } catch (e) {
      setBackups([]);
      showToast?.('⚠ Backups konnten nicht geladen werden');
    }
  };

  useEffect(() => { load(); }, []);

  const downloadJSON = async (day) => {
    try {
      const data = await dataService.fetchBackup(day);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a    = document.createElement('a');
      a.href     = URL.createObjectURL(blob);
      a.download = `azubiboard_${day}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      showToast?.('✓ Backup heruntergeladen');
    } catch (e) {
      showToast?.(`⚠ ${e.message}`);
    }
  };

  const doRestore = async () => {
    if (!confirm) return;
    setActing(true);
    try {
      await dataService.restoreBackup(confirm);
      showToast?.(`↻ Stand vom ${confirm} wiederhergestellt`);
      onRestore?.();              // App lädt frischen State
      onClose?.();
    } catch (e) {
      showToast?.(`⚠ ${e.message}`);
    } finally {
      setActing(false);
      setConfirm(null);
    }
  };

  return (
    <div role="dialog" aria-modal="true"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && !acting && onClose?.()}>
      <div style={{ background: 'var(--c-sf)', border: '1px solid var(--c-bd2)', borderRadius: 12, width: '100%', maxWidth: 560, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.6)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--c-bd)', display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--c-br)', flex: 1 }}>💾 Server-Backups</span>
          <button onClick={onClose} aria-label="Schließen"
            style={{ background: 'transparent', border: 'none', color: C.mu, cursor: 'pointer', padding: '0 6px' }}>
            <IcoX size={14} />
          </button>
        </div>

        <div style={{ padding: '12px 18px', flex: 1, overflowY: 'auto' }}>
          <div style={{ fontSize: 11, color: C.mu, marginBottom: 12, lineHeight: 1.55 }}>
            Der Server speichert täglich automatisch einen Snapshot. Aufbewahrung 30 Tage.
            Jeder Restore wird durch den Save-Mechanismus selbst zum neuen Tagessatz —
            ein versehentlicher Restore kann also vom nächsten Tag rückgängig gemacht werden.
          </div>

          {backups === null && (
            <div style={{ padding: 22, textAlign: 'center', color: C.mu, fontSize: 12 }}>Lädt …</div>
          )}
          {backups?.length === 0 && (
            <div style={{ padding: 22, textAlign: 'center', color: C.mu, fontSize: 12 }}>Keine Backups vorhanden.</div>
          )}
          {backups?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {backups.map(b => (
                <div key={b.snapshot_day} style={{ padding: '8px 12px', background: 'var(--c-sf2)', border: '1px solid var(--c-bd)', borderRadius: 7, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-br)', fontFamily: C.mono }}>{b.snapshot_day}</div>
                    <div style={{ fontSize: 10, color: C.mu, marginTop: 2 }}>
                      {fmtDate(b.snapshot_day)} · {fmtBytes(b.size_bytes)}
                    </div>
                  </div>
                  <button onClick={() => downloadJSON(b.snapshot_day)} disabled={acting}
                    style={{ padding: '5px 9px', fontSize: 10, border: '1px solid var(--c-bd2)', background: 'transparent', color: 'var(--c-mu)', borderRadius: 6, cursor: 'pointer', flexShrink: 0 }}>
                    ⬇ JSON
                  </button>
                  <button onClick={() => setConfirm(b.snapshot_day)} disabled={acting}
                    style={{ padding: '5px 9px', fontSize: 10, border: '1px solid var(--c-yw)', background: 'transparent', color: 'var(--c-yw)', borderRadius: 6, cursor: 'pointer', flexShrink: 0, fontWeight: 700 }}>
                    ↻ Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {confirm && (
          <div style={{ padding: '12px 18px', borderTop: '1px solid var(--c-bd)', background: 'rgba(255,149,0,.06)' }}>
            <div style={{ fontSize: 12, color: 'var(--c-br)', marginBottom: 8 }}>
              <strong>⚠ Achtung:</strong> Aktueller Stand wird durch Snapshot vom <strong>{confirm}</strong> ersetzt.
              Andere Tabs werden beim nächsten Sync das Update sehen.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirm(null)} className="btn" disabled={acting}
                style={{ padding: '6px 12px', fontSize: 11 }}>Abbrechen</button>
              <button onClick={doRestore} disabled={acting}
                style={{ padding: '6px 12px', fontSize: 11, fontWeight: 700, border: '1px solid var(--c-yw)', background: 'var(--c-yw)', color: '#1a1a1a', borderRadius: 6, cursor: acting ? 'wait' : 'pointer' }}>
                {acting ? '⏳ …' : 'Jetzt wiederherstellen'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
