// tests/schema-overlay.test.js — Sprint 12 Phase 3
// overlaySchemaReads überlagert projects+reports aus den Relational-Routes auf
// die Blob-Basis. Pro Sektion Fallback auf Blob bei Fehler. Entitäten ohne
// Read-Route bleiben unverändert aus dem Blob.
import { describe, it, expect, vi } from 'vitest';
import { overlaySchemaReads } from '../src/lib/dataService.js';

function makeFetchJson(routes) {
  // routes: { '/projects': value|Error, '/projects/10': ..., '/reports': ... }
  return vi.fn(async (path) => {
    const v = routes[path];
    if (v instanceof Error) throw v;
    if (v === undefined) throw new Error('404 ' + path);
    return v;
  });
}

describe('overlaySchemaReads', () => {
  it('überlagert projects (mit Detail-Nachladung) und reports, behält andere Blob-Keys', async () => {
    const blob = {
      projects: [{ id: 'old', title: 'alt' }],
      reports:  [{ id: 'oldr' }],
      quizzes:  [{ id: 'q1' }],            // keine Route → muss erhalten bleiben
      calendarEvents: [{ id: 'c1' }],
    };
    const fetchJson = makeFetchJson({
      '/projects': [{ id: 10 }, { id: 11 }],
      '/projects/10': { id: 10, created_by: 1, title: 'P10', status: 'green',
                        tasks: [{ id: 100, title: 'T', status: 'done' }], requirements: [], materials: [] },
      '/projects/11': { id: 11, created_by: 2, title: 'P11', archived: 1, tasks: [], requirements: [], materials: [] },
      '/reports': [{ id: 7, user_id: 1, week_start: '2026-01-12', status: 'signed', file_url: '/r.pdf' }],
    });

    const out = await overlaySchemaReads(blob, fetchJson);

    // projects aus Schema (Blob-Form gemappt)
    expect(out.projects).toHaveLength(2);
    expect(out.projects[0]).toMatchObject({ id: '10', title: 'P10', user_id: '1' });
    expect(out.projects[0].tasks[0]).toMatchObject({ id: '100', text: 'T', done: true });
    expect(out.projects[1].archived).toBe(true);
    // reports aus Schema
    expect(out.reports[0]).toMatchObject({ id: '7', file: '/r.pdf' });
    expect('review_comment' in out.reports[0]).toBe(false);
    expect(out.reports[0].status).toBe('signed');
    // nicht-migrierte Keys unverändert
    expect(out.quizzes).toEqual([{ id: 'q1' }]);
    expect(out.calendarEvents).toEqual([{ id: 'c1' }]);
  });

  it('Projekt-Detail-Fehler → flache Row als Fallback (ohne Kinder)', async () => {
    const fetchJson = makeFetchJson({
      '/projects': [{ id: 10, created_by: 1, title: 'flach' }],
      // '/projects/10' fehlt → wirft → Fallback auf Listen-Row
      '/reports': [],
    });
    const out = await overlaySchemaReads({ projects: [], reports: [] }, fetchJson);
    expect(out.projects[0]).toMatchObject({ id: '10', title: 'flach' });
    expect(out.projects[0].tasks).toEqual([]);
  });

  it('projects-Route-Fehler → Blob-projects bleiben erhalten', async () => {
    const blob = { projects: [{ id: 'keep' }], reports: [{ id: 'r' }] };
    const fetchJson = makeFetchJson({
      '/projects': new Error('boom'),
      '/reports': [{ id: 9, user_id: 1, week_start: '2026-02-02' }],
    });
    const out = await overlaySchemaReads(blob, fetchJson);
    expect(out.projects).toEqual([{ id: 'keep' }]);   // unverändert
    expect(out.reports[0].id).toBe('9');               // überlagert
  });

  it('reports-Route-Fehler → Blob-reports bleiben erhalten', async () => {
    const blob = { projects: [], reports: [{ id: 'keepr' }] };
    const fetchJson = makeFetchJson({
      '/projects': [],
      '/reports': new Error('boom'),
    });
    const out = await overlaySchemaReads(blob, fetchJson);
    expect(out.reports).toEqual([{ id: 'keepr' }]);
  });

  it('robust gegen null-Basis', async () => {
    const fetchJson = makeFetchJson({ '/projects': [], '/reports': [] });
    const out = await overlaySchemaReads(null, fetchJson);
    expect(out.projects).toEqual([]);
    expect(out.reports).toEqual([]);
  });
});

describe('overlaySchemaReads — quizzes / learningPaths / calendar / trainingPlan', () => {
  it('überlagert quizzes aus /quizzes (zu flacher Fragenliste gemappt)', async () => {
    const fetchJson = makeFetchJson({
      '/quizzes': [{ id: 1, title: 'PHP', questions: [
        { id: 10, question_text: 'Q?', question_type: 'single',
          answers: [{ id: 100, answer_text: 'A', is_correct: 1 }] },
      ] }],
    });
    const out = await overlaySchemaReads({ quizzes: [{ id: 'alt' }] }, fetchJson);
    expect(out.quizzes).toHaveLength(1);
    expect(out.quizzes[0]).toMatchObject({ id: '10', category: 'PHP', question: 'Q?' });
  });

  it('überlagert learningPaths + extrahiert pathProgress aus /learningPaths', async () => {
    const fetchJson = makeFetchJson({
      '/learningPaths': [{
        id: 5, title: 'Pfad',
        nodes: [{ id: 'n1', title: 'A' }, { id: 'n2', title: 'B' }],
        edges: [{ from_node: 'n1', to_node: 'n2' }],
        progress: { n1: { completed: 1, completed_at: '2026-01-01' } },
      }],
    });
    const out = await overlaySchemaReads({ learningPaths: [{ id: 'alt' }], pathProgress: {} }, fetchJson);
    expect(out.learningPaths[0]).toMatchObject({ id: '5', title: 'Pfad' });
    expect(out.learningPaths[0].nodes[1].prereqs).toEqual(['n1']);
    expect(out.pathProgress.n1).toEqual({ completed: true, completed_at: '2026-01-01' });
  });

  it('überlagert calendarEvents aus /calendar (event_date→date)', async () => {
    const fetchJson = makeFetchJson({
      '/calendar': [{ id: 9, event_date: '2026-03-01', title: 'Termin', project_id: 3 }],
    });
    const out = await overlaySchemaReads({ calendarEvents: [{ id: 'alt' }] }, fetchJson);
    expect(out.calendarEvents[0]).toMatchObject({ id: '9', date: '2026-03-01', projectId: '3' });
  });

  it('überlagert trainingPlan aus /trainingPlan (Objekt-Passthrough)', async () => {
    const fetchJson = makeFetchJson({
      '/trainingPlan': { goals: [{ id: 'g1' }], examDate: '2027-06-01' },
    });
    const out = await overlaySchemaReads({ trainingPlan: { goals: [] } }, fetchJson);
    expect(out.trainingPlan).toEqual({ goals: [{ id: 'g1' }], examDate: '2027-06-01' });
  });

  it('Route-Fehler je Sektion → jeweiliger Blob-Wert bleibt erhalten', async () => {
    const blob = {
      quizzes: [{ id: 'kq' }], learningPaths: [{ id: 'kp' }],
      pathProgress: { keep: 1 }, calendarEvents: [{ id: 'kc' }], trainingPlan: { keep: true },
    };
    const fetchJson = makeFetchJson({
      '/quizzes': new Error('boom'),
      '/learningPaths': new Error('boom'),
      '/calendar': new Error('boom'),
      '/trainingPlan': new Error('boom'),
    });
    const out = await overlaySchemaReads(blob, fetchJson);
    expect(out.quizzes).toEqual([{ id: 'kq' }]);
    expect(out.learningPaths).toEqual([{ id: 'kp' }]);
    expect(out.pathProgress).toEqual({ keep: 1 });
    expect(out.calendarEvents).toEqual([{ id: 'kc' }]);
    expect(out.trainingPlan).toEqual({ keep: true });
  });
});
