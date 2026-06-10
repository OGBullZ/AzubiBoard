import { describe, it, expect } from 'vitest';
import { buildHeroSuggestion } from '../src/features/dashboard/heroSuggestion.ts';

const isoDay = (n) => {
  const d = new Date(Date.now() + n * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const proj = (tasks) => [{ id: 'P1', title: 'Doku', archived: false, tasks }];
const reportOk = [{ id: 'R', user_id: 1, week_start: isoDay(0) }];

describe('buildHeroSuggestion — Prioritätskette (Anhang D.3)', () => {
  it('überfällige Aufgabe schlägt alles (auch fehlenden Bericht)', () => {
    const h = buildHeroSuggestion(proj([{ id: 'T1', text: 'API', assignee: 1, status: 'open', deadline: isoDay(-2) }]), [], 1);
    expect(h.kind).toBe('overdue');
    expect(h.daysLeft).toBeLessThan(0);
    expect(h.to).toBe('project:P1');
  });

  it('fehlender Wochenbericht schlägt "fällig in ≤3 Tagen" (Berichtspflicht vor Vorarbeit)', () => {
    const h = buildHeroSuggestion(proj([{ id: 'T1', text: 'API', assignee: 1, status: 'open', deadline: isoDay(2) }]), [], 1);
    expect(h.kind).toBe('report');
    expect(h.to).toBe('/reports');
  });

  it('Bericht da + Aufgabe in 2 Tagen → upcoming; ohne alles → clear', () => {
    const h = buildHeroSuggestion(proj([{ id: 'T1', text: 'API', assignee: 1, status: 'open', deadline: isoDay(2) }]), reportOk, 1);
    expect(h.kind).toBe('upcoming');
    expect(buildHeroSuggestion([], reportOk, 1).kind).toBe('clear');
  });

  it('erledigte und fremde Aufgaben zählen nicht', () => {
    const tasks = [
      { id: 'T1', text: 'done', assignee: 1, status: 'done', deadline: isoDay(-5) },
      { id: 'T2', text: 'fremd', assignee: 2, status: 'open', deadline: isoDay(-5) },
    ];
    expect(buildHeroSuggestion(proj(tasks), reportOk, 1).kind).toBe('clear');
  });
});
