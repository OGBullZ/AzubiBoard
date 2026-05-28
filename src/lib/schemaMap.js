// ============================================================
//  schemaMap.js — Sprint 12 Phase 3
//  Reine Reverse-Mapper: relationale DB-Row → Blob-Shape, die das
//  Frontend (Store/Komponenten) erwartet. Kehrt die Forward-Migration
//  aus database/migration_helpers.php um.
//
//  Side-effect-frei und framework-frei → vollständig unit-testbar.
//  Toleriert fehlende Felder (Routes liefern je nach Stand mehr/weniger).
// ============================================================

// Hilfen ----------------------------------------------------------------
const idStr = (v) => (v === null || v === undefined ? undefined : String(v));
const bool  = (v) => v === true || v === 1 || v === '1';
// nullische/leere Werte aus einem Objekt entfernen (kompakte Blob-Form)
function compact(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null) out[k] = v;
  }
  return out;
}

// Time-Entry (aus time_entries) → Blob-timeLog-Eintrag ------------------
export function mapTimeEntryRowToBlob(row = {}) {
  return compact({
    start:       row.started_at ?? row.start ?? null,
    end:         row.ended_at ?? row.end ?? null,
    description: row.description ?? null,
  });
}

// Task ------------------------------------------------------------------
export function mapTaskRowToBlob(row = {}) {
  const title = row.title ?? row.text ?? '';
  const timeLog = Array.isArray(row.timeLog)
    ? row.timeLog.map(mapTimeEntryRowToBlob)
    : [];
  return compact({
    id:                idStr(row.id),
    text:              title,                 // Blob-Tasks lesen primär `text`
    title:             row.title ?? undefined,
    description:       row.description ?? undefined,
    note:              row.note ?? undefined,
    doc:               row.doc ?? undefined,
    protocol:          row.protocol ?? undefined,
    status:            row.status ?? 'open',
    priority:          row.priority ?? undefined,
    assigned_to:       idStr(row.assigned_to),
    due_date:          row.due_date ?? undefined,
    estimated_minutes: row.estimated_minutes ?? undefined,
    completed_at:      row.completed_at ?? undefined,
    done:              (row.status ?? '') === 'done',
    timeLog,
  });
}

// Requirement -----------------------------------------------------------
export function mapRequirementRowToBlob(row = {}) {
  return compact({
    id:           idStr(row.id),
    title:        row.title ?? '',
    description:  row.description ?? undefined,
    done:         bool(row.done),
    priority:     row.priority ?? undefined,
    completed_at: row.completed_at ?? undefined,
  });
}

// Material --------------------------------------------------------------
export function mapMaterialRowToBlob(row = {}) {
  return compact({
    id:          idStr(row.id),
    name:        row.name ?? '',
    description: row.description ?? undefined,
    quantity:    row.quantity !== undefined && row.quantity !== null ? Number(row.quantity) : undefined,
    unit:        row.unit ?? undefined,
    unit_cost:   row.unit_cost !== undefined && row.unit_cost !== null ? Number(row.unit_cost) : undefined,
    supplier:    row.supplier ?? undefined,
    ordered:     bool(row.ordered),
  });
}

// Project (enriched: tasks/requirements/materials) ----------------------
export function mapProjectRowToBlob(row = {}) {
  return compact({
    id:            idStr(row.id),
    title:         row.title ?? '',
    description:   row.description ?? undefined,
    // Blob nutzt user_id als Ersteller-Referenz; relational ist es created_by.
    user_id:       idStr(row.created_by ?? row.user_id),
    status:        row.status ?? undefined,
    priority:      row.priority ?? undefined,
    start_date:    row.start_date ?? undefined,
    deadline:      row.deadline ?? undefined,
    netzplan_unit: row.netzplan_unit ?? undefined,
    color:         row.color ?? undefined,
    archived:      bool(row.archived),
    tasks:         Array.isArray(row.tasks) ? row.tasks.map(mapTaskRowToBlob) : [],
    requirements:  Array.isArray(row.requirements) ? row.requirements.map(mapRequirementRowToBlob) : [],
    materials:     Array.isArray(row.materials) ? row.materials.map(mapMaterialRowToBlob) : [],
  });
}

// Report ----------------------------------------------------------------
export function mapReportRowToBlob(row = {}) {
  // Datei: relational als file_url (String) → Blob führt `file` (hier als String).
  const file = row.file_url ?? row.file ?? undefined;
  return compact({
    id:             idStr(row.id),
    user_id:        idStr(row.user_id),
    reviewer_id:    idStr(row.reviewer_id),
    week_start:     row.week_start ?? undefined,
    week_number:    row.week_number ?? undefined,
    year:           row.year ?? undefined,
    title:          row.title ?? undefined,
    activities:     row.activities ?? undefined,
    learnings:      row.learnings ?? undefined,
    status:         row.status ?? 'draft',
    submitted_at:   row.submitted_at ?? undefined,
    reviewed_at:    row.reviewed_at ?? undefined,
    signed_at:      row.signed_at ?? undefined,
    review_comment: row.reviewer_comment ?? row.review_comment ?? undefined,
    file,
  });
}

// Listen-Helfer ---------------------------------------------------------
export const mapProjectsToBlob = (rows = []) => rows.map(mapProjectRowToBlob);
export const mapReportsToBlob  = (rows = []) => rows.map(mapReportRowToBlob);
