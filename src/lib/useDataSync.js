// ============================================================
//  useDataSync – Smart-Polling für serverseitige Datenänderungen
//
//  Pollt /api/data/version alle POLL_INTERVAL ms. Wenn die Version
//  neuer als unsere Inflight ist und KEIN lokaler Save in der Queue
//  steht (sonst würde er den Server überschreiben), wird der State
//  via getData() neu geladen. Pausiert wenn Tab im Hintergrund.
// ============================================================
import { useEffect, useRef } from 'react';
import { dataService } from './dataService.js';

const POLL_INTERVAL_MS = 25_000; // 25s — gut für Multi-User-Wahrnehmung

export function useDataSync(setData, currentUser, getCurrentData) {
  const lastVersion = useRef(0);
  // Beim ersten Erfolgreichen GET die "Server-Version" einbürgern,
  // damit wir nicht direkt nach Login einen unnötigen Reload triggern.
  const initialized = useRef(false);

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    let timer = null;

    async function poll() {
      if (cancelled) return;
      // Nur wenn Tab sichtbar UND online
      if (typeof document !== 'undefined' && document.hidden) return schedule();
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return schedule();

      const v = await dataService.getDataVersion();
      if (cancelled || !v) return schedule();

      if (!initialized.current) {
        lastVersion.current = v.version || 0;
        initialized.current = true;
        return schedule();
      }

      // Hat ein anderer Tab/Nutzer geschrieben?
      if (v.version > lastVersion.current) {
        // Wenn lokal ein Save in der Queue steht, NICHT überschreiben —
        // unsere Änderung gewinnt erst, wenn sie persistiert ist.
        const status = dataService.getSaveStatus();
        if (!status.pending && !status.inflight) {
          const fresh = await dataService.getData();
          if (!cancelled && fresh) {
            lastVersion.current = v.version;
            setData(fresh);
          }
        }
      }
      schedule();
    }

    function schedule() {
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    }

    // Erster Poll mit kleinem Delay (nach Login etc.)
    timer = setTimeout(poll, 3000);

    // Bei Tab-Focus sofort prüfen (User kommt zurück)
    const onFocus = () => { clearTimeout(timer); poll(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    // Wenn wir SELBST gerade gespeichert haben, Version notieren —
    // sonst würden wir uns selbst beim nächsten Poll als "Update von außen"
    // wahrnehmen.
    const onSyncSuccess = (e) => {
      if (e.detail?.type === 'success' && e.detail.ts) {
        lastVersion.current = Math.floor(e.detail.ts / 1000);
      }
    };
    window.addEventListener('azubiboard:sync', onSyncSuccess);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('azubiboard:sync', onSyncSuccess);
    };
  }, [currentUser, setData, getCurrentData]);
}
