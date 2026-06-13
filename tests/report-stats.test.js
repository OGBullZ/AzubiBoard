// tests/report-stats.test.js — Ausbilder-Analytik AN1: Berichtsheft-Vollständigkeit
import { describe, it, expect } from 'vitest';
import { berichtsheftStats, sumDayHours } from '../src/features/dashboard/reportStats.ts';
import { getISOWeekMonday, fmtLocalDate } from '../src/lib/utils.js';

// Wochenmontag (lokal) für „vor n Wochen" relativ zu `now`.
const monBack = (now, n) => {
  const d = new Date(now);
  d.setDate(d.getDate() - n * 7);
  return fmtLocalDate(getISOWeekMonday(d));
};

describe('berichtsheftStats', () => {
  const now = new Date(2026, 5, 10); // Mi, 10. Juni 2026

  it('zählt vorhandene Wochen korrekt, listet Lücken', () => {
    const reports = [
      { user_id: 7, week_start: monBack(now, 0) },  // diese Woche
      { user_id: 7, week_start: monBack(now, 1) },  // letzte Woche
      { user_id: 7, week_start: monBack(now, 3) },  // vor 3 Wochen
    ];
    const s = berichtsheftStats(reports, 7, now, 12);
    expect(s.total).toBe(12);
    expect(s.have).toBe(3);
    expect(s.missing).toHaveLength(9);
    // vor 2 Wochen fehlt
    expect(s.missing).toContain(monBack(now, 2));
    // vorhandene Wochen sind NICHT in missing
    expect(s.missing).not.toContain(monBack(now, 0));
  });

  it('ist typ-tolerant bei der user_id (string vs number)', () => {
    const reports = [{ user_id: '7', week_start: monBack(now, 0) }];
    const s = berichtsheftStats(reports, 7, now, 12);
    expect(s.have).toBe(1);
  });

  it('quote = have/total, leere Reports → 0', () => {
    expect(berichtsheftStats([], 7, now, 12).quote).toBe(0);
    const full = Array.from({ length: 12 }, (_, i) => ({ user_id: 7, week_start: monBack(now, i) }));
    expect(berichtsheftStats(full, 7, now, 12).quote).toBe(1);
  });
});

describe('sumDayHours', () => {
  it('summiert Tagesstunden, ignoriert leere/ungültige', () => {
    expect(sumDayHours({ mo: { hours: 8 }, di: { hours: 7.5 }, fr: { hours: 4 } })).toBe(19.5);
    expect(sumDayHours({ mo: { text: 'nur Text' }, di: {} })).toBe(0);
    expect(sumDayHours(undefined)).toBe(0);
    expect(sumDayHours({})).toBe(0);
  });
});
