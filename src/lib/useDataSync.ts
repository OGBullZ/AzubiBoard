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
import { persistData } from './utils';

const POLL_INTERVAL_MS = 25_000; // 25s — gut für Multi-User-Wahrnehmung

type AppData = Record<string, unknown>;
type CurrentUser = Record<string, unknown> | null;

export function useDataSync(
  setData: (data: AppData, opts?: { persist?: boolean }) => void,
  currentUser: CurrentUser,
): void {
  const lastVersion = useRef(0);
  // Beim ersten Erfolgreichen GET die "Server-Version" einbürgern,
  // damit wir nicht direkt nach Login einen unnötigen Reload triggern.
  const initialized = useRef(false);

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // In-flight-Guard: poll() yieldet bei await (getDataVersion/getData). Ohne diesen
    // Guard würde ein focus/visibilitychange während eines laufenden Polls eine zweite,
    // parallele Poll-Kette starten (überlappende, nicht abbrechbare Timer-Schleifen).
    let polling = false;

    async function poll() {
      if (cancelled || polling) return;
      // Nur wenn Tab sichtbar UND online — sonst nur neu schedulen
      if ((typeof document !== 'undefined' && document.hidden) ||
          (typeof navigator !== 'undefined' && navigator.onLine === false)) {
        return schedule();
      }

      polling = true;
      try {
        const v = await dataService.getDataVersion();
        if (cancelled || !v) return;

        if (!initialized.current) {
          lastVersion.current = v.version || 0;
          initialized.current = true;
          return;
        }

        // Hat ein anderer Tab/Nutzer geschrieben?
        if (v.version > lastVersion.current) {
          // Wenn lokal ein Save in der Queue steht, NICHT überschreiben —
          // unsere Änderung gewinnt erst, wenn sie persistiert ist.
          const status = dataService.getSaveStatus();
          if (!status.pending && !status.inflight) {
            // Bug-Hunt 08-06 #20: Der Re-Check auf pending/inflight allein hat eine Lücke.
            // Tippt der User während des GET-await und ist sein POST VOR der GET-Antwort
            // fertig, sind beide Flags wieder false — der Guard greift genau dann nicht,
            // und setData(fresh) stülpt den Vor-Edit-Stand über die frische Eingabe
            // (in State UND localStorage). Der Zähler der abgeschlossenen Saves schließt
            // diese Lücke: er steigt auch dann, wenn die Queue am Ende wieder leer ist.
            const savesVorher = dataService.getSaveStatus().completedSaves;
            const fresh = await dataService.getData();
            const after = dataService.getSaveStatus();
            if (!cancelled && fresh && !after.pending && !after.inflight
                && after.completedSaves === savesVorher) {
              lastVersion.current = v.version;
              // persist:false — Server-Daten nicht zurück-POSTen (Echo-Schleife
              // zwischen Clients); localStorage manuell aktuell halten.
              setData(fresh, { persist: false });
              persistData(fresh);
            }
          }
        }
      } finally {
        polling = false;
        if (!cancelled) schedule();
      }
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
    const onSyncSuccess = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.type === 'success' && (detail.version || detail.ts)) {
        // Server-Version ist autoritativ; Client-Uhr (ts) nur als Fallback —
        // Clock-Skew würde sonst fremde Updates verschlucken oder Reload-Schleifen erzeugen.
        lastVersion.current = detail.version || Math.floor(detail.ts / 1000);
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
  }, [currentUser, setData]);
}
