// ============================================================
//  Regressionstests zur zweiten Runde des Bug-Hunts vom 2026-08-06
//  (die zunächst als „roh" zurückgestellten Funde, danach verifiziert).
// ============================================================
import { describe, it, expect } from 'vitest';
import { shiftWeeksLocal, parseLocalDate, fmtLocalDate, isoWeekMonday } from '../src/lib/utils';
import { restoreFromTrash, softDelete } from '../src/lib/trash.js';
import { buildNewsCards } from '../src/features/onboarding/welcomeNewsData.ts';

// Datum N Tage von heute als ISO (YYYY-MM-DD) — LOKAL, wie im bestehenden welcome-news-Test
const isoDay = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return fmtLocalDate(d); };

describe('Fund 22 — „Älteste"/„Nächste" nennen den richtigen Eintrag', () => {
  const azubi = { id: 1, role: 'azubi', name: 'A' };
  const bau = (tasks) => ({
    projects: [{ id: 'p1', title: 'Projekt A', tasks, assignees: [] }],
    reports: [{ id: 'R1', user_id: 1, status: 'draft', week_start: isoDay(0) }],
    users: [], groups: [],
  });

  it('nennt die am längsten überfällige Aufgabe, nicht die erstbeste', () => {
    const data = bau([
      { id: 't1', text: 'Doku',      assignee: 1, status: 'open', deadline: isoDay(-2) },
      { id: 't2', text: 'Migration', assignee: 1, status: 'open', deadline: isoDay(-30) },
    ]);

    const overdue = buildNewsCards(data, azubi, null, 0).find(c => c.key === 'overdue');

    expect(overdue).toBeDefined();
    expect(overdue.sub).toContain('Migration');
    expect(overdue.sub).not.toContain('Doku');
  });

  it('nennt die nächstfällige Aufgabe, nicht die erstbeste', () => {
    const data = bau([
      { id: 't1', text: 'Spaeter', assignee: 1, status: 'open', deadline: isoDay(3) },
      { id: 't2', text: 'Morgen',  assignee: 1, status: 'open', deadline: isoDay(1) },
    ]);

    const soon = buildNewsCards(data, azubi, null, 0).find(c => c.key === 'soon');

    expect(soon).toBeDefined();
    expect(soon.sub).toContain('Morgen');
  });
});

describe('Fund 24 — week_start wird auf den ISO-Montag normalisiert', () => {
  it('isoWeekMonday bildet jeden Wochentag auf denselben Montag ab', () => {
    // Mi 05.08.2026 gehört zur Woche ab Mo 03.08.2026
    expect(isoWeekMonday('2026-08-05')).toBe('2026-08-03');
    expect(isoWeekMonday('2026-08-03')).toBe('2026-08-03');
    expect(isoWeekMonday('2026-08-09')).toBe('2026-08-03');   // Sonntag gehört noch dazu
  });

  it('ist idempotent (mehrfaches Speichern verschiebt nichts)', () => {
    const einmal  = isoWeekMonday('2026-08-05');
    const zweimal = isoWeekMonday(einmal);
    expect(zweimal).toBe(einmal);
  });

  it('das Autofill-Fenster deckt danach Mo–So ab', () => {
    const ws = isoWeekMonday('2026-08-05');
    const d  = parseLocalDate(ws); d.setDate(d.getDate() + 6);
    expect(ws).toBe('2026-08-03');
    expect(fmtLocalDate(d)).toBe('2026-08-09');
  });
});

describe('Fund 25 — Datums-Strings werden lokal geparst', () => {
  it('trifft den richtigen Kalendertag (nicht UTC-Mitternacht)', () => {
    const d = parseLocalDate('2026-08-03');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(3);
    expect(fmtLocalDate(d)).toBe('2026-08-03');
  });

  it('der Folgetag für DTEND ist wirklich der Folgetag (iCal-Nulllängen-Event)', () => {
    const d = parseLocalDate('2026-08-03');
    d.setDate(d.getDate() + 1);
    expect(fmtLocalDate(d)).toBe('2026-08-04');
  });

  it('bleibt über beide DST-Wechsel korrekt', () => {
    expect(fmtLocalDate(parseLocalDate('2026-03-29'))).toBe('2026-03-29');
    expect(fmtLocalDate(parseLocalDate('2026-10-25'))).toBe('2026-10-25');
  });

  it('reicht vollständige Zeitstempel unverändert durch', () => {
    const iso = '2026-08-03T22:30:00.000Z';
    expect(parseLocalDate(iso).toISOString()).toBe(new Date(iso).toISOString());
  });

  it('liefert für leere Eingabe ein ungültiges Datum (kein stiller Default)', () => {
    expect(Number.isNaN(parseLocalDate('').getTime())).toBe(true);
    expect(Number.isNaN(parseLocalDate(null).getTime())).toBe(true);
  });
});

describe('Fund 21 — Undo nimmt gezielt zurück, nicht den ganzen Blob', () => {
  it('holt das gelöschte Projekt zurück und lässt fremde Änderungen stehen', () => {
    const start = {
      projects: [{ id: 'p1', title: 'Meins' }],
      reports: [], trash: { projects: [], reports: [], goals: [] },
    };
    // Löschen
    const nachDelete = softDelete(start, 'projects', start.projects[0], { id: 'u1', name: 'A' });
    expect(nachDelete.projects).toHaveLength(0);
    expect(nachDelete.trash.projects).toHaveLength(1);

    // Fremde Änderung trifft im Undo-Fenster ein (anderer Tab / Poll)
    const mitFremd = { ...nachDelete, reports: [{ id: 'r-fremd', title: 'Fremder Bericht' }] };

    // Undo gegen den AKTUELLEN Stand
    const nachUndo = restoreFromTrash(mitFremd, 'projects', 'p1');

    expect(nachUndo.projects.map(p => p.id)).toEqual(['p1']);   // eigenes zurück
    expect(nachUndo.trash.projects).toHaveLength(0);
    expect(nachUndo.reports).toHaveLength(1);                    // fremdes NICHT verloren
    expect(nachUndo.reports[0].id).toBe('r-fremd');
  });

  it('der alte Voll-Blob-Undo hätte die fremde Änderung verworfen (Gegenprobe)', () => {
    const start = { projects: [{ id: 'p1', title: 'Meins' }], reports: [], trash: { projects: [], reports: [], goals: [] } };
    const nachDelete = softDelete(start, 'projects', start.projects[0], { id: 'u1', name: 'A' });
    const mitFremd = { ...nachDelete, reports: [{ id: 'r-fremd' }] };

    const altesVerhalten = start;   // setData(snapshot)
    expect(altesVerhalten.reports).toHaveLength(0);
    expect(mitFremd.reports).toHaveLength(1);   // genau das ging verloren
  });
});

describe('Fund 10 (Regression) — Wochensprung bleibt DST-fest', () => {
  it('zählt über das Sommerzeit-Ende sauber weiter', () => {
    expect(shiftWeeksLocal('2026-11-02', -1)).toBe('2026-10-26');
    expect(shiftWeeksLocal('2026-10-26', -1)).toBe('2026-10-19');
  });
});
