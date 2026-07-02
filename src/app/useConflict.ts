import { useState, useEffect, useCallback } from 'react';
import { dataService } from '../lib/dataService';
import { persistData } from '../lib/utils';
import type { ShowToast } from '../lib/hooks';

// ── J2: Speicherkonflikt (Sync-Event vom dataService) → Dialog + Auflösung ──
export function useConflict(setData: (d: any, opts?: any) => void, showToast: ShowToast) {
  const [conflict, setConflict] = useState<any>(null);  // J2: Konflikt-Payload (Sync-Event-Detail, JS-Boundary) → any

  // J2: Conflict-Event vom dataService abfangen → Dialog anzeigen
  useEffect(() => {
    const onSync = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.type === 'conflict') {
        setConflict(detail);
        showToast('⚠ Speicherkonflikt — bitte entscheiden');
      }
    };
    window.addEventListener('azubiboard:sync', onSync);
    return () => window.removeEventListener('azubiboard:sync', onSync);
  }, [showToast]);

  // J2: Konflikt-Handler — Server-Version übernehmen
  const acceptServer = useCallback(() => {
    if (!conflict?.serverData) { setConflict(null); return; }
    // persist:false — die Daten kommen gerade vom Server, kein redundanter Re-POST.
    // localStorage trotzdem aktualisieren, sonst reanimiert ein Offline-Reload den verworfenen Stand.
    setData(conflict.serverData, { persist: false });
    persistData(conflict.serverData);
    dataService.discardPending();   // User hat sich gegen die lokalen Edits entschieden → Queue leeren
    dataService.setKnownVersion(conflict.serverVersion || 0);
    setConflict(null);
    showToast('✓ Server-Version übernommen');
  }, [conflict, setData, showToast]);

  // J2: Konflikt-Handler — eigene Version forcieren
  const forceMine = useCallback(async () => {
    if (!conflict?.clientSnapshot) { setConflict(null); return; }
    await dataService.forceSave(conflict.clientSnapshot);
    setConflict(null);
    showToast('⚡ Deine Version wurde gespeichert');
  }, [conflict, showToast]);

  // J2: Konflikt-Handler — frischen Server-Stand laden (eigene Änderungen verwerfen)
  const reloadServer = useCallback(() => { window.location.reload(); }, []);

  return { conflict, acceptServer, forceMine, reloadServer };
}
