// tests/daydiff.test.js — dayDiffLocal: Tagesdifferenz auf lokaler Mitternachts-Achse
// Lockt Bug-Hunt 3 #7: reine Datums-Strings dürfen NICHT als UTC-Mitternacht geparst
// werden, sonst Off-by-one im nächtlichen Zeitfenster.
import { describe, it, expect } from 'vitest';
import { dayDiffLocal } from '../src/lib/utils.js';

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('dayDiffLocal', () => {
  it('heute = 0, unabhängig von der lokalen Uhrzeit', () => {
    // 01:00 lokal: alte Formel (UTC-Parse) hätte in UTC+x fälschlich 1 geliefert.
    const now = new Date(2026, 5, 12, 1, 0, 0); // 12.06.2026, lokal
    expect(dayDiffLocal('2026-06-12', now)).toBe(0);
  });

  it('gestern = -1, morgen = +1 (date-only)', () => {
    const now = new Date(2026, 5, 12, 1, 0, 0);
    expect(dayDiffLocal('2026-06-11', now)).toBe(-1);
    expect(dayDiffLocal('2026-06-13', now)).toBe(1);
  });

  it('spätabends bleibt heute = 0 (kein Vorgriff auf morgen)', () => {
    const now = new Date(2026, 5, 12, 23, 30, 0);
    expect(dayDiffLocal('2026-06-12', now)).toBe(0);
    expect(dayDiffLocal('2026-06-13', now)).toBe(1);
  });

  it('akzeptiert Date-Objekte und normalisiert auf Mitternacht', () => {
    const now = new Date(2026, 5, 12, 8, 0, 0);
    expect(dayDiffLocal(new Date(2026, 5, 15, 22, 0, 0), now)).toBe(3);
  });

  it('default now = jetzt: heute liefert 0', () => {
    const todayStr = ymd(new Date());
    expect(dayDiffLocal(todayStr)).toBe(0);
  });
});
