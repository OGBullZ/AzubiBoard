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
