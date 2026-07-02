import { useEffect, useRef } from 'react';
import { dataService } from '../lib/dataService';
import { sameId } from '../lib/utils';
import type { User, AppState } from '../types';

// ── K5: Neue activityLog-Einträge automatisch an Server-Audit weiterleiten. ──
//    Set merkt sich gesendete IDs pro Session — bei Reload starten wir
//    mit nur den neuesten 30 Einträgen als "schon gesehen", damit
//    der Audit-Server nicht mit kompletter Historie geflutet wird.
// activityLog ist im Schema z.array(z.unknown) (Blob-Form, kein Domain-Typ) → e/Set any belassen.
export function useAuditForward(data: AppState | null, currentUser: User | null) {
  const auditSentRef = useRef<Set<any> | null>(null);
  useEffect(() => {
    if (!data?.activityLog || !currentUser) return;
    if (!auditSentRef.current) {
      // Initial-Pool: alles was schon da war ist "alt". Auch bei leerem Log initialisieren,
      // sonst würde der erste neue Eintrag als Initial-Pool behandelt und nie gesendet.
      auditSentRef.current = new Set((data.activityLog || []).map((e: any) => e.id));
      return;
    }
    const seen   = auditSentRef.current;
    // Nur EIGENE Einträge forwarden: fremde kommen per Sync-Poll/BroadcastChannel herein
    // und würden sonst mit dem eigenen JWT dupliziert (falscher Akteur im Server-Audit).
    const fresh  = (data.activityLog || []).filter((e: any) =>
      e.id && !seen.has(e.id) && sameId(e.userId, currentUser.id));
    if (!fresh.length) return;
    // Senden in der zeitlich aufsteigenden Reihenfolge
    fresh.slice().reverse().forEach((e: any) => {
      seen.add(e.id);
      dataService.writeAudit({
        type:          e.type,
        entity_title:  e.entityTitle,
        project_id:    e.projectId   || null,
        project_title: e.projectTitle || null,
        action:        e.action || null,
        meta:          { client_id: e.id, client_ts: e.ts },
      });
    });
  }, [data?.activityLog, currentUser]);
}
