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
  mapQuizzesToBlob,
  mapLearningPathRowToBlob,
  extractPathProgress,
  mapCalendarEventRowToBlob,
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
  it('requirement done als bool aus 0/1, text als Blob-Alias von title', () => {
    expect(mapRequirementRowToBlob({ id: 1, title: 'r', done: 1 }).done).toBe(true);
    expect(mapRequirementRowToBlob({ id: 2, title: 'r', done: 0 }).done).toBe(false);
    // Komponenten lesen `text`, nicht `title`
    expect(mapRequirementRowToBlob({ id: 3, title: 'Anforderung', done: 0 }).text).toBe('Anforderung');
  });

  it('material ordered bool + Zahlen, qty/cost/taskId als Blob-Aliase', () => {
    const m = mapMaterialRowToBlob({ id: 3, name: 'Mat', quantity: '5', unit_cost: '12.5', ordered: 1, task_id: 9 });
    expect(m.ordered).toBe(true);
    expect(m.quantity).toBe(5);
    // Komponenten lesen qty/cost/taskId
    expect(m.qty).toBe(5);
    expect(m.cost).toBe(12.5);
    expect(m.taskId).toBe(9);
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
  it('mappt file_url→file, reviewer_comment (Key wie Frontend liest), ids→String', () => {
    const r = mapReportRowToBlob({
      id: 7, user_id: 1, reviewer_id: 2, week_start: '2026-01-12', status: 'signed',
      reviewer_comment: 'ok', file_url: '/uploads/r.pdf',
    });
    expect(r.id).toBe('7');
    expect(r.user_id).toBe('1');
    expect(r.reviewer_id).toBe('2');
    expect(r.reviewer_comment).toBe('ok');
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

describe('mapQuizzesToBlob', () => {
  it('flacht quizzes[].questions[] zu Fragenliste, Kategorie aus quiz.title', () => {
    const out = mapQuizzesToBlob([
      {
        id: 1, title: 'PHP',
        questions: [
          { id: 10, question_text: 'Was ist $_GET?', question_type: 'single',
            answers: [{ id: 100, answer_text: 'Superglobal', is_correct: 1 },
                      { id: 101, answer_text: 'Funktion', is_correct: 0 }] },
        ],
      },
      {
        id: 2, title: 'SQL',
        questions: [{ id: 20, question_text: 'JOIN?', question_type: 'multiple', answers: [] }],
      },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ id: '10', question: 'Was ist $_GET?', category: 'PHP', type: 'single' });
    expect(out[0].answers).toEqual([
      { id: '100', text: 'Superglobal', correct: true },
      { id: '101', text: 'Funktion', correct: false },
    ]);
    // Kategorie aus dem jeweiligen Quiz, type 'multiple' erhalten
    expect(out[1]).toMatchObject({ id: '20', category: 'SQL', type: 'multiple', answers: [] });
  });

  it('Quiz ohne questions → leeres Ergebnis', () => {
    expect(mapQuizzesToBlob([{ id: 1, title: 'X' }])).toEqual([]);
    expect(mapQuizzesToBlob()).toEqual([]);
  });
});

describe('mapLearningPathRowToBlob', () => {
  it('mappt nodes, leitet prereqs aus edges (from_node → to_node) ab, lehrjahr→Number', () => {
    const p = mapLearningPathRowToBlob({
      id: 5, title: 'Grundlagen', lehrjahr: '2',
      nodes: [{ id: 'n1', title: 'A', type: 'video' }, { id: 'n2', title: 'B' }],
      edges: [{ from_node: 'n1', to_node: 'n2' }],
    });
    expect(p).toMatchObject({ id: '5', title: 'Grundlagen', lehrjahr: 2 });
    expect(p.nodes).toHaveLength(2);
    // n2 hat n1 als Voraussetzung; n1 hat keine
    expect(p.nodes[0]).toMatchObject({ id: 'n1', title: 'A', type: 'video', prereqs: [] });
    expect(p.nodes[1]).toMatchObject({ id: 'n2', title: 'B', type: 'article', prereqs: ['n1'] });
  });

  it('leere nodes/edges → leeres nodes-Array, lehrjahr weggelassen', () => {
    const p = mapLearningPathRowToBlob({ id: 1, title: 'leer' });
    expect(p.nodes).toEqual([]);
    expect('lehrjahr' in p).toBe(false);
  });
});

describe('extractPathProgress', () => {
  it('flacht progress je Node zu {completed, completed_at}', () => {
    const prog = extractPathProgress([
      { id: 1, progress: { n1: { completed: 1, completed_at: '2026-01-01' }, n2: { completed: 0 } } },
      { id: 2, progress: { n3: { completed: true } } },
    ]);
    expect(prog.n1).toEqual({ completed: true, completed_at: '2026-01-01' });
    expect(prog.n2.completed).toBe(false);
    expect(prog.n3.completed).toBe(true);
  });

  it('Pfade ohne progress → leeres Objekt', () => {
    expect(extractPathProgress([{ id: 1 }])).toEqual({});
    expect(extractPathProgress()).toEqual({});
  });
});

describe('mapCalendarEventRowToBlob', () => {
  it('mappt event_date→date, description→note, project_id→String, type-Default', () => {
    const e = mapCalendarEventRowToBlob({
      id: 9, event_date: '2026-03-01', title: 'Termin', description: 'Notiz', project_id: 3,
    });
    expect(e).toMatchObject({ id: '9', date: '2026-03-01', title: 'Termin', note: 'Notiz', projectId: '3', type: 'event' });
  });

  it('ohne event_date/project_id → date/projectId weggelassen (kompakt)', () => {
    const e = mapCalendarEventRowToBlob({ id: 1, title: 'x', type: 'deadline' });
    expect('date' in e).toBe(false);
    expect('projectId' in e).toBe(false);
    expect(e.type).toBe('deadline');
  });
});
