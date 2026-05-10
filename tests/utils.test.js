// tests/utils.test.js — Smoke-Tests für lib/utils.js
// Schwerpunkt: ISO-Wochen, Datums-Helfer, addActivity (waren Quelle der Sprint-1-Bugs).
import { describe, it, expect } from 'vitest';
import {
  getISOWeek, getKW, getISOWeekMonday, fmtLocalDate, fmtDate,
  getDeadlineDaysLeft, addActivity, uid,
} from '../src/lib/utils.js';

describe('getISOWeek', () => {
  // Ankerpunkte aus ISO 8601 — manuell verifiziert
  it('29.12.2025 (Mo) ist KW1 von 2026', () => {
    expect(getISOWeek('2025-12-29')).toEqual({ week: 1, year: 2026 });
  });

  it('01.01.2024 (Mo) ist KW1 von 2024', () => {
    expect(getISOWeek('2024-01-01')).toEqual({ week: 1, year: 2024 });
  });

  it('31.12.2023 (So) ist KW52 von 2023', () => {
    expect(getISOWeek('2023-12-31')).toEqual({ week: 52, year: 2023 });
  });

  it('04.01.2021 (Mo) ist KW1 von 2021', () => {
    expect(getISOWeek('2021-01-04')).toEqual({ week: 1, year: 2021 });
  });

  it('Donnerstag-Regel: 01.01.2026 (Do) → KW1/2026', () => {
    expect(getISOWeek('2026-01-01')).toEqual({ week: 1, year: 2026 });
  });

  it('Mittwoch in Mitten der Woche: 03.06.2026 → KW23/2026', () => {
    expect(getISOWeek('2026-06-03')).toEqual({ week: 23, year: 2026 });
  });

  it('akzeptiert Date-Objekt', () => {
    const d = new Date(2025, 11, 29); // Lokal: 29.12.2025
    expect(getISOWeek(d).week).toBe(1);
  });

  it('null/undefined → null Felder', () => {
    expect(getISOWeek(null)).toEqual({ year: null, week: null });
    expect(getISOWeek('')).toEqual({ year: null, week: null });
    expect(getISOWeek('not-a-date')).toEqual({ year: null, week: null });
  });

  it('getKW (Kompakt-Variante) gibt nur Woche zurück', () => {
    expect(getKW('2025-12-29')).toBe(1);
    expect(getKW('2024-06-12')).toBe(24);
  });
});

describe('getISOWeekMonday', () => {
  it('Mittwoch → liefert Montag derselben Woche', () => {
    const m = getISOWeekMonday('2026-06-03'); // Mittwoch
    expect(m.getFullYear()).toBe(2026);
    expect(m.getMonth()).toBe(5);  // Juni (0-basiert)
    expect(m.getDate()).toBe(1);   // Montag
  });

  it('Sonntag → liefert Montag DIESER Woche (nicht nächste)', () => {
    const m = getISOWeekMonday('2026-06-07'); // Sonntag
    expect(m.getDate()).toBe(1);   // 1. Juni 2026 (Mo)
  });
});

describe('fmtLocalDate', () => {
  it('formatiert Date korrekt als YYYY-MM-DD', () => {
    expect(fmtLocalDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(fmtLocalDate(new Date(2024, 11, 31))).toBe('2024-12-31');
  });
  it('akzeptiert Date-String', () => {
    expect(fmtLocalDate('2026-06-15T10:00:00')).toMatch(/^2026-06-15$/);
  });
  it('null/invalid → leerer String', () => {
    expect(fmtLocalDate(null)).toBe('');
    expect(fmtLocalDate('not-a-date')).toBe('');
  });
});

describe('fmtDate', () => {
  it('formatiert deutsches Format', () => {
    expect(fmtDate('2026-06-15')).toMatch(/15\.06\.2026/);
  });
  it('null/empty → leerer String', () => {
    expect(fmtDate(null)).toBe('');
    expect(fmtDate('')).toBe('');
  });
});

describe('getDeadlineDaysLeft', () => {
  it('null deadline → null', () => {
    expect(getDeadlineDaysLeft(null)).toBeNull();
  });
  it('Datum in Zukunft → positive Zahl', () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    const d = getDeadlineDaysLeft(future.toISOString().slice(0, 10));
    expect(d).toBeGreaterThanOrEqual(4);
    expect(d).toBeLessThanOrEqual(6);
  });
  it('Datum in Vergangenheit → negative Zahl', () => {
    const past = new Date();
    past.setDate(past.getDate() - 3);
    const d = getDeadlineDaysLeft(past.toISOString().slice(0, 10));
    expect(d).toBeLessThan(0);
  });
});

describe('addActivity', () => {
  it('fügt Eintrag oben in activityLog ein', () => {
    const data = { activityLog: [{ id: 'old', ts: '2024-01-01' }] };
    const next = addActivity(data, { type: 'test', userId: 'u1' });
    expect(next.activityLog).toHaveLength(2);
    expect(next.activityLog[0].type).toBe('test');
    expect(next.activityLog[0].id).toBeTruthy();
    expect(next.activityLog[0].ts).toBeTruthy();
    expect(next.activityLog[1].id).toBe('old');
  });

  it('begrenzt auf 100 Einträge (Sliding Window)', () => {
    const log = Array.from({ length: 100 }, (_, i) => ({ id: `e${i}` }));
    const next = addActivity({ activityLog: log }, { type: 'new' });
    expect(next.activityLog).toHaveLength(100);
    expect(next.activityLog[0].type).toBe('new');
    expect(next.activityLog[99].id).toBe('e98'); // ältester (e99) wurde rausgeschoben
  });

  it('initialisiert activityLog wenn nicht vorhanden', () => {
    const next = addActivity({ users: [] }, { type: 'first' });
    expect(next.activityLog).toHaveLength(1);
    expect(next.users).toEqual([]); // andere Felder bleiben
  });
});

describe('uid', () => {
  it('liefert eindeutige Strings', () => {
    const ids = new Set();
    for (let i = 0; i < 1000; i++) ids.add(uid());
    expect(ids.size).toBe(1000);
  });
});
