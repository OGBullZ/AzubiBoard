// Ausbilder-Analytik (AN1): Berichtsheft-Vollständigkeit eines Azubis.
// Pure + unit-getestet (tests/report-stats.test.js). Kein Server nötig.
import { getISOWeekMonday, fmtLocalDate, sameId } from '../../lib/utils.js';
import type { Report, Id } from '../../types';

// Tagesstruktur (Mo–Fr) eines Berichts — Schlüssel + Stundensumme. Pure, testbar.
export const WEEK_DAY_KEYS = ['mo', 'di', 'mi', 'do', 'fr'] as const;
export const sumDayHours = (days?: Record<string, { text?: string | null; hours?: number | null }>): number =>
  WEEK_DAY_KEYS.reduce((s, k) => s + (Number(days?.[k]?.hours) || 0), 0);

// Prüfungs-Readiness (0–100) aus 3 Säulen: Berichtsheft 40 %, Lernziele 35 %, Aufgaben 25 %.
// Säulen ohne Daten (null) werden ausgeklammert und das Gewicht umverteilt — fair bei z. B. 0 Lernzielen.
export type Readiness = { score: number; label: string; tone: 'green' | 'yellow' | 'red' | 'none' };
export function readinessScore(parts: { heftQuote?: number | null; goalQuote?: number | null; taskQuote?: number | null }): Readiness {
  const pillars: [number | null | undefined, number][] = [
    [parts.heftQuote, 0.40],
    [parts.goalQuote, 0.35],
    [parts.taskQuote, 0.25],
  ];
  let wSum = 0, qSum = 0;
  for (const [q, w] of pillars) {
    if (q == null || Number.isNaN(q)) continue;
    wSum += w;
    qSum += w * Math.max(0, Math.min(1, q));
  }
  if (wSum === 0) return { score: 0, label: 'keine Daten', tone: 'none' };
  const score = Math.round((qSum / wSum) * 100);
  const tone: Readiness['tone'] = score >= 80 ? 'green' : score >= 55 ? 'yellow' : 'red';
  const label = score >= 80 ? 'Auf Kurs' : score >= 55 ? 'Im Aufbau' : 'Aufmerksamkeit';
  return { score, label, tone };
}

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
