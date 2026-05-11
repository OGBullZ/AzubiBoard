// tests/trash.test.js — Soft-Delete + Papierkorb-Verhalten
import { describe, it, expect } from 'vitest';
import {
  ensureTrash, softDelete, restoreFromTrash, purgeFromTrash,
  autoCleanTrash, trashCount,
} from '../src/lib/trash.js';

const USER = { id: 'u1', name: 'Test' };

describe('ensureTrash', () => {
  it('legt leeren Bin an wenn nicht vorhanden', () => {
    const next = ensureTrash({ users: [] });
    expect(next.trash).toEqual({ projects: [], reports: [], goals: [] });
    expect(next.users).toEqual([]);
  });
  it('normalisiert teilweise vorhandenen Bin', () => {
    const next = ensureTrash({ trash: { projects: [{ id: 'p1' }] } });
    expect(next.trash.projects).toHaveLength(1);
    expect(next.trash.reports).toEqual([]);
    expect(next.trash.goals).toEqual([]);
  });
});

describe('softDelete', () => {
  it('verschiebt Projekt in Trash mit Metadaten', () => {
    const data = { projects: [{ id: 'p1', title: 'A' }, { id: 'p2', title: 'B' }] };
    const next = softDelete(data, 'projects', { id: 'p1', title: 'A' }, USER);
    expect(next.projects).toHaveLength(1);
    expect(next.projects[0].id).toBe('p2');
    expect(next.trash.projects).toHaveLength(1);
    expect(next.trash.projects[0]).toMatchObject({ id: 'p1', title: 'A', deletedBy: 'u1', deletedByName: 'Test' });
    expect(next.trash.projects[0].deletedAt).toBeTruthy();
  });
  it('Goals leben in trainingPlan.goals', () => {
    const data = {
      trainingPlan: { goals: [{ id: 'g1' }, { id: 'g2' }] },
    };
    const next = softDelete(data, 'goals', { id: 'g1' }, USER);
    expect(next.trainingPlan.goals).toHaveLength(1);
    expect(next.trash.goals).toHaveLength(1);
    expect(next.trash.goals[0].id).toBe('g1');
  });
});

describe('restoreFromTrash', () => {
  it('legt Eintrag zurück in Original-Collection und putzt Meta-Felder', () => {
    let data = { projects: [], trash: { projects: [{ id: 'p1', title: 'A', deletedAt: 'X', deletedBy: 'u1', deletedByName: 'T' }], reports: [], goals: [] } };
    data = restoreFromTrash(data, 'projects', 'p1');
    expect(data.projects).toHaveLength(1);
    expect(data.projects[0].deletedAt).toBeUndefined();
    expect(data.projects[0].deletedBy).toBeUndefined();
    expect(data.trash.projects).toHaveLength(0);
  });
});

describe('purgeFromTrash', () => {
  it('entfernt Eintrag aus Trash ohne Restore', () => {
    let data = { trash: { projects: [{ id: 'p1' }, { id: 'p2' }], reports: [], goals: [] } };
    data = purgeFromTrash(data, 'projects', 'p1');
    expect(data.trash.projects).toHaveLength(1);
    expect(data.trash.projects[0].id).toBe('p2');
  });
});

describe('autoCleanTrash', () => {
  it('löscht Einträge älter als 30 Tage', () => {
    const now      = new Date();
    const oldDate  = new Date(now.getTime() - 31 * 86_400_000).toISOString();
    const newDate  = new Date(now.getTime() -  5 * 86_400_000).toISOString();
    const data = { trash: { projects: [{ id: 'old', deletedAt: oldDate }, { id: 'new', deletedAt: newDate }], reports: [], goals: [] } };
    const cleaned = autoCleanTrash(data);
    expect(cleaned.trash.projects.map(e => e.id)).toEqual(['new']);
  });
  it('respektiert custom maxAgeDays', () => {
    const data = { trash: { projects: [{ id: 'a', deletedAt: new Date(Date.now() - 86_400_000 * 3).toISOString() }], reports: [], goals: [] } };
    expect(autoCleanTrash(data, 2).trash.projects).toHaveLength(0);
    expect(autoCleanTrash(data, 4).trash.projects).toHaveLength(1);
  });
});

describe('trashCount', () => {
  it('summiert alle Typen', () => {
    const data = { trash: { projects: [1,2,3], reports: [1], goals: [1,2] } };
    expect(trashCount(data)).toBe(6);
  });
  it('0 wenn data.trash fehlt', () => {
    expect(trashCount({})).toBe(0);
    expect(trashCount(null)).toBe(0);
  });
});
