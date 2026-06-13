// Ausbilder-Analytik (AN1): Berichtsheft-Vollständigkeit eines Azubis.
// Pure + unit-getestet (tests/report-stats.test.js). Kein Server nötig.
import { getISOWeekMonday, fmtLocalDate, sameId } from '../../lib/utils.js';
import type { Report, Id } from '../../types';

// Tagesstruktur (Mo–Fr) eines Berichts — Schlüssel + Stundensumme. Pure, testbar.
export const WEEK_DAY_KEYS = ['mo', 'di', 'mi', 'do', 'fr'] as const;
export const sumDayHours = (days?: Record<string, { text?: string; hours?: number }>): number =>
  WEEK_DAY_KEYS.reduce((s, k) => s + (Number(days?.[k]?.hours) || 0), 0);

export type BerichtsheftStats = { have: number; total: number; missing: string[]; quote: number };

// Über die letzten `weeks` ISO-Kalenderwochen (inkl. der aktuellen): wie viele haben
// einen Bericht des Azubis, welche Wochenmontage fehlen. Erkennt Lücken im Berichtsheft.
export function berichtsheftStats(reports: Report[], azubiId: Id, now: Date, weeks = 12): BerichtsheftStats {
  // Erwartete Wochenmontage (lokal, DST-sicher): heute, -7, -14, …
  const expected: string[] = [];
  for (let i = 0; i < weeks; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const mon = getISOWeekMonday(d);
    if (mon) expected.push(fmtLocalDate(mon));
  }
  // Vorhandene Berichts-Wochen des Azubis, auf ihren Wochenmontag normalisiert.
  const haveWeeks = new Set<string>();
  for (const r of reports || []) {
    if (!sameId(r.user_id, azubiId) || !r.week_start) continue;
    const mon = getISOWeekMonday(r.week_start as string);
    if (mon) haveWeeks.add(fmtLocalDate(mon));
  }
  const missing = expected.filter(w => !haveWeeks.has(w));
  const have = expected.length - missing.length;
  const total = expected.length;
  return { have, total, missing, quote: total ? have / total : 0 };
}
