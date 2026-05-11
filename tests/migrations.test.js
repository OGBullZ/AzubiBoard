// tests/migrations.test.js — Schema-Migrations-Pipeline (L2)
import { describe, it, expect } from 'vitest';
import { migrateData, pendingMigrations, CURRENT_SCHEMA_VERSION } from '../src/lib/migrations.js';

describe('migrateData', () => {
  it('Brand-new data (v0) wird bis aktuelle Version migriert', () => {
    const next = migrateData({ users: [], projects: [], reports: [] });
    expect(next.schema_version).toBe(CURRENT_SCHEMA_VERSION);
    expect(next._migrationsApplied).toEqual([1, 2, 3]);
    // Migration 2 muss trash + trainingPlan + activityLog initialisiert haben
    expect(next.trash).toEqual({ projects: [], reports: [], goals: [] });
    expect(next.trainingPlan).toEqual({ goals: [], examDate: null });
    expect(next.activityLog).toEqual([]);
  });

  it('v2 → v3: nur die letzte Migration läuft', () => {
    const v2 = {
      schema_version: 2,
      trash: { projects: [], reports: [], goals: [] },
      projects: [{ id: 'p1', tasks: [{ text: 'foo' }, { id: 'has-id', text: 'bar' }] }],
      reports: [{ id: 'r1', week_start: '2025-01-01' }],
    };
    const next = migrateData(v2);
    expect(next.schema_version).toBe(3);
    expect(next._migrationsApplied).toEqual([3]);
    expect(next.projects[0].tasks[0].id).toMatch(/^task_legacy_/);
    expect(next.projects[0].tasks[1].id).toBe('has-id');
    expect(next.reports[0].updated_at).toBeTruthy();
  });

  it('Bereits aktuelle Version → no-op', () => {
    const data = { schema_version: CURRENT_SCHEMA_VERSION, users: [{ id: 'u1' }] };
    const next = migrateData(data);
    expect(next).toBe(data);  // gleiche Referenz
  });

  it('Höhere als aktuelle Version (Downgrade) wird nicht angefasst', () => {
    const data = { schema_version: 999, users: [] };
    const next = migrateData(data);
    expect(next).toBe(data);
  });

  it('null / undefined → unverändert', () => {
    expect(migrateData(null)).toBeNull();
    expect(migrateData(undefined)).toBeUndefined();
  });

  it('Migration ist idempotent: zweimal anwenden = einmal', () => {
    const once  = migrateData({ users: [] });
    const twice = migrateData(once);
    // Bei zweitem Lauf bleibt schema_version, _migrationsApplied ist []
    expect(twice.schema_version).toBe(CURRENT_SCHEMA_VERSION);
    expect(twice).toBe(once);
  });
});

describe('pendingMigrations', () => {
  it('listet alle ausstehenden Versionen', () => {
    expect(pendingMigrations({ schema_version: 0 })).toEqual([1, 2, 3]);
    expect(pendingMigrations({ schema_version: 2 })).toEqual([3]);
    expect(pendingMigrations({ schema_version: CURRENT_SCHEMA_VERSION })).toEqual([]);
  });
  it('ohne schema_version → ab v1', () => {
    expect(pendingMigrations({})).toEqual([1, 2, 3]);
  });
});
