// Property-basierte Tests der Datums-Helfer (IMPROVEMENTS A · "Property-Tests Datum").
//
// WARUM: Die wiederkehrende Bug-Klasse im Projekt war Datums-Off-by-one durch
// UTC-vs-lokal-Parsing und naive ms/86400000-Arithmetik (Bug-Hunt 3 #7, Bug-Hunt 4,
// die KW-Formel-Funde). Diese Tests kodieren die DST-Stabilität als INVARIANTE statt
// einzelner Beispiele: über zufällige Daten in einer Zeitzone MIT Sommerzeit muss die
// Tagesdifferenz die reine Kalendertag-Anzahl sein und alle 7 Tage einer ISO-Woche
// dieselbe KW tragen — egal ob eine Zeitumstellung dazwischen liegt.
//
// CI läuft sonst in UTC (keine DST) → wir erzwingen Europe/Berlin. Die Helfer lesen
// die Zeitzone zur Laufzeit, daher genügt die Zuweisung vor den Testaufrufen.
process.env.TZ = 'Europe/Berlin';

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  dayDiffLocal, fmtLocalDate, getISOWeek, getKW, getISOWeekMonday, isoWeekMonday,
} from '../src/lib/utils.ts';

// ── Generatoren ──────────────────────────────────────────────
// Gültiges Kalenderdatum (Tag 1–28 vermeidet Monats-Überlauf); Spannweite deckt
// viele DST-Übergänge ab (Berlin: Ende März / Ende Oktober jedes Jahr).
const ymd = fc.record({
  y: fc.integer({ min: 2020, max: 2030 }),
  m: fc.integer({ min: 0, max: 11 }),
  d: fc.integer({ min: 1, max: 28 }),
});
const pad = (n) => String(n).padStart(2, '0');
const ymdStr = ({ y, m, d }) => `${y}-${pad(m + 1)}-${pad(d)}`;
// Unabhängiges Orakel: Kalendertage über UTC (ignoriert DST per Definition → exakte Ganzzahl).
const utcDays = (a, b) => Math.round((Date.UTC(a.y, a.m, a.d) - Date.UTC(b.y, b.m, b.d)) / 86400000);

// Schutz gegen vakuum-wahre Properties: läuft die Suite NICHT in einer Zeitzone mit
// Sommerzeit (z.B. UTC-CI ohne TZ-Override), wären die DST-Invarianten bedeutungslos.
describe('Test-Umgebung', () => {
  it('läuft in einer Zeitzone MIT Sommerzeit (sonst sind die DST-Invarianten leer)', () => {
    const summer = -new Date(2026, 6, 1).getTimezoneOffset() / 60;  // Juli
    const winter = -new Date(2026, 0, 1).getTimezoneOffset() / 60;  // Januar
    expect(summer - winter).toBe(1);
  });
});

describe('dayDiffLocal — Tagesdifferenz ist DST-stabil', () => {
  it('= reine Kalendertag-Anzahl, unabhängig von Uhrzeit und Zeitumstellung', () => {
    fc.assert(fc.property(ymd, ymd, fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }), (a, b, hh, mm) => {
      // now darf eine beliebige Uhrzeit am Tag b haben; das Ergebnis muss der Kalendertag-Delta sein.
      const now = new Date(b.y, b.m, b.d, hh, mm);
      expect(dayDiffLocal(ymdStr(a), now)).toBe(utcDays(a, b));
    }), { numRuns: 500 });
  });

  it('selber Tag → 0, und antisymmetrisch auf Mitternachts-Achsen', () => {
    fc.assert(fc.property(ymd, ymd, (a, b) => {
      const midA = new Date(a.y, a.m, a.d);
      const midB = new Date(b.y, b.m, b.d);
      expect(dayDiffLocal(ymdStr(a), midA)).toBe(0);
      expect(dayDiffLocal(ymdStr(a), midB)).toBe(-dayDiffLocal(ymdStr(b), midA));
    }));
  });
});

describe('fmtLocalDate — kein UTC-Off-by-one beim Round-Trip', () => {
  it('Mittags-Parse eines YYYY-MM-DD round-trippt verlustfrei (auch an DST-Tagen)', () => {
    fc.assert(fc.property(ymd, (a) => {
      const s = ymdStr(a);
      // 12:00 ist DST-sicher (die Frühjahrs-Lücke 02:00–03:00 wird nie getroffen).
      expect(fmtLocalDate(new Date(`${s}T12:00:00`))).toBe(s);
      expect(fmtLocalDate(new Date(a.y, a.m, a.d))).toBe(s);
    }));
  });
});

describe('ISO-Woche — Konsistenz-Invarianten', () => {
  it('getISOWeekMonday liefert einen Montag; isoWeekMonday ist idempotent', () => {
    fc.assert(fc.property(ymd, (a) => {
      const mon = getISOWeekMonday(ymdStr(a));
      expect(mon).not.toBeNull();
      expect(mon.getDay()).toBe(1);                 // 1 = Montag (lokal)
      const wk = isoWeekMonday(ymdStr(a));
      expect(isoWeekMonday(wk)).toBe(wk);            // Fixpunkt
    }));
  });

  it('alle 7 Tage einer ISO-Woche tragen dieselbe (Jahr, KW) — fängt naive KW-Formeln', () => {
    fc.assert(fc.property(ymd, (a) => {
      const mon = getISOWeekMonday(ymdStr(a));
      const ref = getISOWeek(fmtLocalDate(mon));
      expect(ref.week).toBeGreaterThanOrEqual(1);
      expect(ref.week).toBeLessThanOrEqual(53);
      for (let k = 0; k < 7; k++) {
        const day = new Date(mon);
        day.setDate(day.getDate() + k);             // kalenderbasiert → DST-sicher
        const iso = getISOWeek(fmtLocalDate(day));
        expect(iso.year).toBe(ref.year);
        expect(iso.week).toBe(ref.week);
        expect(getKW(fmtLocalDate(day))).toBe(iso.week);
      }
    }));
  });
});

// ── Explizite DST-Regressionsfälle (Europe/Berlin 2026) ──────
// Frühjahr: 29.03.2026 (02:00→03:00, 23-Stunden-Tag) · Herbst: 25.10.2026 (03:00→02:00, 25-Stunden-Tag)
describe('DST-Grenztage 2026 (Europe/Berlin) — explizite Regression', () => {
  it('Frühjahrsumstellung: 23-Stunden-Tag bleibt 1 Kalendertag', () => {
    // 28.03 +1h vor Umstellung → 29.03 ist trotzdem genau 1 Tag entfernt
    expect(dayDiffLocal('2026-03-29', new Date(2026, 2, 28, 1, 30))).toBe(1);
    expect(dayDiffLocal('2026-03-30', new Date(2026, 2, 29, 23, 30))).toBe(1);
    expect(dayDiffLocal('2026-03-29', new Date(2026, 2, 29, 23, 59))).toBe(0);
  });

  it('Herbstumstellung: 25-Stunden-Tag bleibt 1 Kalendertag', () => {
    expect(dayDiffLocal('2026-10-26', new Date(2026, 9, 25, 2, 30))).toBe(1);
    expect(dayDiffLocal('2026-10-25', new Date(2026, 9, 24, 0, 1))).toBe(1);
  });

  it('bekannte ISO-Wochen-Anker (Jahresgrenzen)', () => {
    expect(getISOWeek('2025-12-29')).toEqual({ year: 2026, week: 1 });  // Mo der KW1/2026
    expect(getISOWeek('2024-01-01')).toEqual({ year: 2024, week: 1 });
    expect(getISOWeek('2026-01-01')).toEqual({ year: 2026, week: 1 });  // Do → KW1
    expect(getISOWeek('2026-12-31')).toEqual({ year: 2026, week: 53 }); // Do → KW53
  });
});
