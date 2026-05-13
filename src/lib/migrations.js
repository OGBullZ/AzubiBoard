// ============================================================
//  migrations.js — Schema-Migrations für data-Blob (L2)
//
//  data.schema_version  hält die aktuelle Schema-Version. Beim
//  Laden wird `migrateData(data)` aufgerufen und alle nötigen
//  Migration-Steps werden in Reihenfolge angewendet. Jede neue
//  Schema-Änderung kriegt eine neue Migration-Function.
//
//  Vertrag pro Migration:
//   - bekommt ein altes data-Objekt
//   - liefert NEUES data-Objekt (immutable, kein Side-Effect)
//   - darf annehmen dass alle vorherigen Migrations gelaufen sind
//
//  Wenn data.schema_version >= aktuelle Version → no-op.
// ============================================================

// Aktuelle Schema-Version. Bei jeder neuen Migration um 1 hochzählen.
export const CURRENT_SCHEMA_VERSION = 4;

// Einzelne Migrations als Map: zielversion → migrate(prev)
const MIGRATIONS = {
  1: (data) => {
    // Migration v0 → v1:
    //   - Sicherstellen dass calendarEvents existiert
    //   - timeLog-Felder pro Task initialisieren wenn fehlend
    const projects = (data.projects || []).map(p => ({
      ...p,
      tasks: (p.tasks || []).map(t => ({ ...t, timeLog: t.timeLog || [] })),
    }));
    return {
      ...data,
      calendarEvents: data.calendarEvents || [],
      projects,
    };
  },

  2: (data) => {
    // Migration v1 → v2:
    //   - trash-Bin initialisieren (J3)
    //   - trainingPlan-Defaults
    return {
      ...data,
      trash:        data.trash || { projects: [], reports: [], goals: [] },
      trainingPlan: data.trainingPlan || { goals: [], examDate: null },
      activityLog:  data.activityLog || [],
    };
  },

  4: (data) => {
    // Migration v3 → v4:
    //   - Custom Quiz-Fragen aus localStorage in data.quizzes migrieren
    let quizzes = data.quizzes || [];
    if (quizzes.length === 0) {
      try {
        const stored = JSON.parse(localStorage.getItem('azubiboard_custom_quiz') || '[]');
        if (stored.length > 0) quizzes = stored;
      } catch {}
    }
    return { ...data, quizzes };
  },

  3: (data) => {
    // Migration v2 → v3:
    //   - Tasks ohne id bekommen eine — verhindert Render-Glitches
    //   - Reports ohne updated_at bekommen einen Default
    const projects = (data.projects || []).map(p => ({
      ...p,
      tasks: (p.tasks || []).map((t, i) => ({
        ...t,
        id: t.id || `task_legacy_${Date.now()}_${i}`,
      })),
    }));
    const reports = (data.reports || []).map(r => ({
      ...r,
      updated_at: r.updated_at || r.created_at || new Date().toISOString(),
    }));
    return { ...data, projects, reports };
  },
};

export function migrateData(data) {
  if (!data || typeof data !== 'object') return data;
  const from = Number(data.schema_version) || 0;
  if (from >= CURRENT_SCHEMA_VERSION) return data;

  let migrated = data;
  const applied = [];
  for (let v = from + 1; v <= CURRENT_SCHEMA_VERSION; v++) {
    const fn = MIGRATIONS[v];
    if (!fn) continue;
    try {
      migrated = fn(migrated);
      applied.push(v);
    } catch (err) {
      // Bei Migrations-Fehlern: lieber alte Daten behalten als kaputtschreiben
      console.error(`[migrations] step v${v} failed:`, err);
      return { ...data, _migrationError: err.message, _migrationFailedAt: v };
    }
  }
  return {
    ...migrated,
    schema_version: CURRENT_SCHEMA_VERSION,
    _lastMigratedAt: new Date().toISOString(),
    _migrationsApplied: applied,
  };
}

// Test-Helper: gibt zurück welche Migrations laufen würden, ohne sie anzuwenden
export function pendingMigrations(data) {
  const from = Number(data?.schema_version) || 0;
  const list = [];
  for (let v = from + 1; v <= CURRENT_SCHEMA_VERSION; v++) {
    if (MIGRATIONS[v]) list.push(v);
  }
  return list;
}
