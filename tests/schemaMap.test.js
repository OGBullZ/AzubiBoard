// tests/schemaMap.test.js — Sprint 12 Phase 3
// Reverse-Mapper (Relational-Row → Blob-Shape). Reine Funktionen,
// daher direkt testbar. Stellt sicher, dass die vom Frontend erwartete
// Blob-Form korrekt rekonstruiert wird (id→String, text aus title,
// done aus status, bool-Felder, file aus file_url, timeLog).
import { describe, it, expect } from 'vitest';
import {
  mapTaskRowToBlob,
  mapRequirementRowToBlob,
  mapMaterialRowToBlob,
  mapProjectRowToBlob,
  mapReportRowToBlob,
  mapTimeEntryRowToBlob,
} from '../src/lib/schemaMap.js';

describe('mapTaskRowToBlob', () => {
  it('mappt title→text, leitet done aus status ab, id→String', () => {
    const t = mapTaskRowToBlob({ id: 5, title: 'Aufgabe', status: 'done', priority: 'high', assigned_to: 2 });
    expect(t.id).toBe('5');
    expect(t.text).toBe('Aufgabe');
    expect(t.title).toBe('Aufgabe');
    expect(t.done).toBe(true);
    expect(t.assigned_to).toBe('2');
    expect(t.timeLog).toEqual([]);
  });

  it('done=false wenn status != done', () => {
    expect(mapTaskRowToBlob({ id: 1, title: 'x', status: 'open' }).done).toBe(false);
  });

  it('mappt timeLog aus time_entries (started_at/ended_at)', () => {
    const t = mapTaskRowToBlob({
      id: 1, title: 'x', status: 'open',
      timeLog: [{ started_at: '2026-01-01 10:00:00', ended_at: '2026-01-01 11:00:00', description: 'a' }],
    });
    expect(t.timeLog).toEqual([{ start: '2026-01-01 10:00:00', end: '2026-01-01 11:00:00', description: 'a' }]);
  });

  it('lässt nullische Felder weg (kompakt)', () => {
    const t = mapTaskRowToBlob({ id: 1, title: 'x', status: 'open', note: null, assigned_to: null });
    expect('note' in t).toBe(false);
    expect('assigned_to' in t).toBe(false);
  });
});

describe('mapRequirementRowToBlob / mapMaterialRowToBlob', () => {
  it('requirement done als bool aus 0/1', () => {
    expect(mapRequirementRowToBlob({ id: 1, title: 'r', done: 1 }).done).toBe(true);
    expect(mapRequirementRowToBlob({ id: 2, title: 'r', done: 0 }).done).toBe(false);
  });

  it('material ordered bool + Zahlen', () => {
    const m = mapMaterialRowToBlob({ id: 3, name: 'Mat', quantity: '5', unit_cost: '12.5', ordered: 1 });
    expect(m.ordered).toBe(true);
    expect(m.quantity).toBe(5);
    expect(m.unit_cost).toBe(12.5);
    expect(m.id).toBe('3');
  });
});

describe('mapProjectRowToBlob', () => {
  it('mappt created_by→user_id, archived bool, verschachtelte Kinder', () => {
    const p = mapProjectRowToBlob({
      id: 10, created_by: 1, title: 'Projekt', status: 'green', archived: 0,
      tasks: [{ id: 100, title: 'T', status: 'open' }],
      requirements: [{ id: 200, title: 'R', done: 1 }],
      materials: [{ id: 300, name: 'M', ordered: 0 }],
    });
    expect(p.id).toBe('10');
    expect(p.user_id).toBe('1');
    expect(p.archived).toBe(false);
    expect(p.tasks).toHaveLength(1);
    expect(p.tasks[0].text).toBe('T');
    expect(p.requirements[0].done).toBe(true);
    expect(p.materials[0].name).toBe('M');
  });

  it('leere Kind-Arrays wenn nicht vorhanden', () => {
    const p = mapProjectRowToBlob({ id: 1, created_by: 1, title: 'x' });
    expect(p.tasks).toEqual([]);
    expect(p.requirements).toEqual([]);
    expect(p.materials).toEqual([]);
  });
});

describe('mapReportRowToBlob', () => {
  it('mappt file_url→file, reviewer_comment→review_comment, ids→String', () => {
    const r = mapReportRowToBlob({
      id: 7, user_id: 1, reviewer_id: 2, week_start: '2026-01-12', status: 'signed',
      reviewer_comment: 'ok', file_url: '/uploads/r.pdf',
    });
    expect(r.id).toBe('7');
    expect(r.user_id).toBe('1');
    expect(r.reviewer_id).toBe('2');
    expect(r.review_comment).toBe('ok');
    expect(r.file).toBe('/uploads/r.pdf');
    expect(r.status).toBe('signed');
  });

  it('status default draft, optionale Felder weggelassen', () => {
    const r = mapReportRowToBlob({ id: 1, user_id: 1, week_start: '2026-01-01' });
    expect(r.status).toBe('draft');
    expect('file' in r).toBe(false);
    expect('reviewer_id' in r).toBe(false);
  });
});

describe('mapTimeEntryRowToBlob', () => {
  it('mappt started_at/ended_at → start/end', () => {
    expect(mapTimeEntryRowToBlob({ started_at: 'a', ended_at: 'b' })).toEqual({ start: 'a', end: 'b' });
  });
});
