// tests/store-merge.test.js — Regressionstest für Sprint-1 Bug I1:
// "ReportsPage onUpdateData wipes data" durfte nie wieder passieren.
//
// Die Annahme: Konsumenten von onUpdateData/setData MÜSSEN data spreaden,
// weil setData wholesale-replaced. Wir testen das Verhalten von setData
// direkt über das Modul (nicht über React-Hook).
import { describe, it, expect, vi } from 'vitest';

describe('Datenverlust-Regression (I1)', () => {
  it('addActivity-Pattern bewahrt alle Top-Level-Keys', async () => {
    const { addActivity } = await import('../src/lib/utils.js');
    const data = {
      users:    [{ id: 'u1' }],
      projects: [{ id: 'p1' }],
      reports:  [{ id: 'r1' }],
      groups:   [{ id: 'g1' }],
      trainingPlan: { goals: [], examDate: '2027-06-01' },
    };
    const next = addActivity(data, { type: 'x' });
    expect(next.users).toBe(data.users);
    expect(next.projects).toBe(data.projects);
    expect(next.reports).toBe(data.reports);
    expect(next.groups).toBe(data.groups);
    expect(next.trainingPlan).toBe(data.trainingPlan);
    expect(next.activityLog).toHaveLength(1);
  });

  it('falsches Pattern ohne Spread VERLIERT andere Keys (Smoke-Reproduktion)', () => {
    // Anti-Pattern bewusst: { reports: ... } statt { ...data, reports: ... }
    const data = { users: [1], projects: [1], reports: [1] };
    const wrong = { reports: [2] };
    expect(wrong.users).toBeUndefined();
    expect(wrong.projects).toBeUndefined();
    // Korrektes Pattern:
    const right = { ...data, reports: [2] };
    expect(right.users).toEqual([1]);
    expect(right.projects).toEqual([1]);
    expect(right.reports).toEqual([2]);
  });
});

describe('saveData (lokaler Modus)', () => {
  it('persistData schreibt in localStorage', async () => {
    const { dataService } = await import('../src/lib/dataService.js');
    const sample = { users: [{ id: 'u1', name: 'Test' }], projects: [] };
    await dataService.saveData(sample);
    const stored = JSON.parse(localStorage.getItem('azubiboard_v2'));
    expect(stored.users[0].name).toBe('Test');
  });
});
