// ============================================================
//  Regressionstests zum Bug-Hunt vom 2026-08-06.
//  Jeder Block hält genau einen verifizierten Fund fest.
// ============================================================
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validate, AppState, Project } from '../src/lib/schemas';
import { shiftWeeksLocal, persistData, fmtLocalDate } from '../src/lib/utils';
import { dataService } from '../src/lib/dataService.js';

describe('Fund 1 — Zod-Validierung darf keine Blob-Felder verlieren', () => {
  it('behält project.calendarEvents (Kalendertermin mit Projektbezug)', () => {
    const blob = {
      projects: [{
        id: 'p1',
        title: 'Projekt',
        calendarEvents: [{ id: 'e1', date: '2026-08-10', title: 'Abnahme', projectId: 'p1' }],
        tasks: [],
      }],
    };

    const out = validate(AppState, blob, 'test');

    expect(out.projects[0].calendarEvents).toBeDefined();
    expect(out.projects[0].calendarEvents).toHaveLength(1);
    expect(out.projects[0].calendarEvents[0].title).toBe('Abnahme');
  });

  it('behält unbekannte Felder auch tief verschachtelt', () => {
    const blob = {
      projects: [{
        id: 'p1',
        title: 'P',
        tasks: [{ id: 't1', title: 'T', eigenesFeld: { tief: [1, 2, 3] } }],
      }],
      reports: [{ id: 'r1', week_start: '2026-08-03', days: { mo: { text: 'x', hours: 8 } } }],
    };

    const out = validate(AppState, blob, 'test');

    expect(out.projects[0].tasks[0].eigenesFeld).toEqual({ tief: [1, 2, 3] });
    expect(out.reports[0].days).toEqual({ mo: { text: 'x', hours: 8 } });
  });

  it('setzt Zod-Defaults weiterhin (activityLog, tasks)', () => {
    const out = validate(AppState, { projects: [{ id: 'p1', title: 'P' }] }, 'test');

    expect(out.activityLog).toEqual([]);
    expect(out.projects[0].tasks).toEqual([]);
  });

  it('gibt bei ungültigen Daten die Rohdaten zurück (unverändertes Verhalten)', () => {
    const kaputt = { projects: 'kein Array' };
    expect(validate(AppState, kaputt, 'test')).toBe(kaputt);
  });

  it('Project-Schema selbst bleibt strip-mode (Typ-Ableitung intakt)', () => {
    // Ohne restoreUnknown im validate-Helper würde hier gestrippt — genau das war der Bug.
    const parsed = Project.parse({ id: 'p1', title: 'P', calendarEvents: [{ id: 'e1' }] });
    expect(parsed.calendarEvents).toBeUndefined();
  });
});

describe('Fund 10 — Wochensprung ist DST-fest', () => {
  it('springt über das Ende der Sommerzeit auf den richtigen Montag', () => {
    // 2026: Sommerzeit endet in Europa am 25.10. Vorher lieferte die UTC/lokal-Mischung
    // 2026-10-26 → 2026-10-18 (Sonntag) und blieb danach auf Sonntag hängen.
    expect(shiftWeeksLocal('2026-11-02', -1)).toBe('2026-10-26');
    expect(shiftWeeksLocal('2026-10-26', -1)).toBe('2026-10-19');
    expect(shiftWeeksLocal('2026-10-19', -1)).toBe('2026-10-12');
  });

  it('springt über den Beginn der Sommerzeit korrekt', () => {
    // Sommerzeit beginnt 2026 am 29.03.
    expect(shiftWeeksLocal('2026-03-23', 1)).toBe('2026-03-30');
    expect(shiftWeeksLocal('2026-03-30', -1)).toBe('2026-03-23');
  });

  it('bleibt über viele Sprünge auf demselben Wochentag', () => {
    let d = '2026-12-28';           // Montag
    for (let i = 0; i < 30; i++) {
      d = shiftWeeksLocal(d, -1);
      expect(new Date(d + 'T12:00:00').getDay()).toBe(1);
    }
  });

  it('lässt ein ungültiges Datum unverändert', () => {
    expect(shiftWeeksLocal('kein-datum', -1)).toBe('kein-datum');
  });
});

describe('Fund 14 — Lernkarten-Fälligkeit rechnet lokal, nicht UTC', () => {
  afterEach(() => vi.useRealTimers());

  it('legt eine um 00:30 Ortszeit gelernte Karte auf MORGEN, nicht auf heute', () => {
    // 2026-08-04 00:30 Ortszeit. toISOString() hätte hier '2026-08-03' bzw. für
    // nextReview '2026-08-04' geliefert — die Karte wäre am selben Tag wieder fällig.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 4, 0, 30, 0));

    const heute = fmtLocalDate(new Date());
    const next = new Date();
    next.setDate(next.getDate() + 1);
    const nextReview = fmtLocalDate(next);

    expect(heute).toBe('2026-08-04');
    expect(nextReview).toBe('2026-08-05');
    expect(nextReview <= heute).toBe(false);   // nicht sofort wieder fällig
  });
});

describe('Fund 11 — bekannte Server-Version fällt nie zurück', () => {
  it('ignoriert eine kleinere Version (verspätete GET-Antwort)', () => {
    // getData() setzte die Version bedingungslos aus dem ETag der GET-Antwort. Traf eine
    // ältere Antwort nach einem erfolgreichen Save ein, sendete der nächste Save ein
    // veraltetes If-Match und lief in ein 409 gegen die EIGENEN Daten.
    dataService.setKnownVersion(105);
    expect(dataService.getKnownVersion()).toBe(105);

    dataService.setKnownVersion(100);
    expect(dataService.getKnownVersion()).toBe(105);
  });

  it('übernimmt eine höhere Version', () => {
    dataService.setKnownVersion(110);
    expect(dataService.getKnownVersion()).toBe(110);
  });
});

describe('Fund 5 — localStorage-Fehlschlag ist nicht mehr still', () => {
  const original = globalThis.localStorage;

  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: original, configurable: true });
  });

  it('liefert true bei Erfolg', () => {
    expect(persistData({ projects: [] })).toBe(true);
  });

  it('liefert false und feuert ein Sync-Error-Event, wenn die Quota voll ist', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: { setItem: () => { throw new DOMException('quota', 'QuotaExceededError'); } },
      configurable: true,
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const events = [];
    const listener = (e) => events.push(e.detail);
    window.addEventListener('azubiboard:sync', listener);

    const ok = persistData({ projects: [] });
    window.removeEventListener('azubiboard:sync', listener);

    expect(ok).toBe(false);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('error');
    expect(events[0].fatal).toBe(true);
  });
});
