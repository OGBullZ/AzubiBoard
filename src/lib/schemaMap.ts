// ============================================================
//  schemaMap.ts — Sprint 12 Phase 3  (T1 Sprint 14: js → ts migriert)
//  Reine Reverse-Mapper: relationale DB-Row → Blob-Shape, die das
//  Frontend (Store/Komponenten) erwartet. Kehrt die Forward-Migration
//  aus database/migration_helpers.php um.
//
//  Side-effect-frei und framework-frei → vollständig unit-testbar.
//  Toleriert fehlende Felder (Routes liefern je nach Stand mehr/weniger).
// ============================================================

type Row = Record<string, unknown>;
type Blob = Record<string, unknown>;

// Hilfen ----------------------------------------------------------------
const idStr = (v: unknown): string | undefined =>
  (v === null || v === undefined ? undefined : String(v));
const bool = (v: unknown): boolean => v === true || v === 1 || v === '1';
// nullische/leere Werte aus einem Objekt entfernen (kompakte Blob-Form)
function compact(obj: Blob): Blob {
  const out: Blob = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null) out[k] = v;
  }
  return out;
}

// Time-Entry (aus time_entries) → Blob-timeLog-Eintrag ------------------
export function mapTimeEntryRowToBlob(row: Row = {}): Blob {
  return compact({
    start:       row.started_at ?? row.start ?? null,
    end:         row.ended_at ?? row.end ?? null,
    description: row.description ?? null,
  });
}

// Task ------------------------------------------------------------------
export function mapTaskRowToBlob(row: Row = {}): Blob {
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
export function mapRequirementRowToBlob(row: Row = {}): Blob {
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
export function mapMaterialRowToBlob(row: Row = {}): Blob {
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
export function mapProjectRowToBlob(row: Row = {}): Blob {
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
export function mapReportRowToBlob(row: Row = {}): Blob {
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
    // Frontend liest `reviewer_comment` (nicht review_comment) → unter diesem Key emittieren
    reviewer_comment: row.reviewer_comment ?? row.review_comment ?? undefined,
    file,
  });
}

// Quiz-Frage (aus quiz_questions+quiz_answers, quiz.title als Kategorie) --------
export function mapQuizQuestionRowToBlob(row: Row = {}, category = ''): Blob {
  return compact({
    id:       String(row.id ?? ''),
    question: row.question_text ?? '',
    category: category,
    type:     row.question_type === 'multiple' ? 'multiple' : 'single',
    answers:  Array.isArray(row.answers)
      ? row.answers.map((a: Row) => ({
          id:      String(a.id ?? ''),
          text:    a.answer_text ?? '',
          correct: bool(a.is_correct),
        }))
      : [],
  });
}

// Lernpfad (mit Nodes, Edges → prereqs, Progress) -----------------------
export function mapLearningPathRowToBlob(path: Row = {}, _uid: string | null = null): Blob {
  const nodes  = Array.isArray(path.nodes) ? path.nodes : [];
  const edges  = Array.isArray(path.edges) ? path.edges : [];
  const _prog  = path.progress && typeof path.progress === 'object' ? path.progress : {};

  // Edge: from_node → to_node bedeutet to_node hat from_node als Voraussetzung
  const prereqMap: Record<string, string[]> = {};
  for (const e of edges as Row[]) {
    const to = String(e.to_node ?? '');
    if (!prereqMap[to]) prereqMap[to] = [];
    prereqMap[to].push(String(e.from_node ?? ''));
  }

  const mappedNodes = (nodes as Row[]).map((n) => compact({
    id:          String(n.id ?? ''),
    title:       n.title ?? '',
    description: n.description ?? undefined,
    type:        n.type ?? 'article',
    content:     n.content ?? undefined,
    prereqs:     prereqMap[String(n.id)] ?? [],
  }));

  return compact({
    id:          String(path.id ?? ''),
    title:       path.title ?? '',
    description: path.description ?? undefined,
    lehrjahr:    path.lehrjahr ? Number(path.lehrjahr) : undefined,
    nodes:       mappedNodes,
  });
}

// pathProgress aus Lernpfad-Liste ----------------------------------------
export function extractPathProgress(paths: Row[] = []): Record<string, Blob> {
  const out: Record<string, Blob> = {};
  for (const path of paths) {
    const prog = path.progress && typeof path.progress === 'object' ? path.progress : {};
    for (const [nodeId, p] of Object.entries(prog as Record<string, Row>)) {
      out[String(nodeId)] = {
        completed:    bool(p.completed),
        completed_at: p.completed_at ?? undefined,
      };
    }
  }
  return out;
}

// Kalender-Ereignis ------------------------------------------------------
export function mapCalendarEventRowToBlob(row: Row = {}): Blob {
  return compact({
    id:        String(row.id ?? ''),
    date:      row.event_date ?? null,
    title:     row.title ?? '',
    note:      row.description ?? undefined,
    projectId: row.project_id ? String(row.project_id) : undefined,
    type:      row.type ?? 'event',
    color:     row.color ?? undefined,
  });
}

// Listen-Helfer ---------------------------------------------------------
export const mapProjectsToBlob = (rows: Row[] = []) => rows.map(mapProjectRowToBlob);
export const mapReportsToBlob  = (rows: Row[] = []) => rows.map(mapReportRowToBlob);
export const mapCalendarEventsToBlob = (rows: Row[] = []) => rows.map(mapCalendarEventRowToBlob);
export function mapQuizzesToBlob(quizzes: Row[] = []): Blob[] {
  const questions: Blob[] = [];
  for (const q of quizzes) {
    const cat = (q.title as string) ?? '';
    for (const question of ((q.questions as Row[]) ?? [])) {
      questions.push(mapQuizQuestionRowToBlob(question, cat));
    }
  }
  return questions;
}
export const mapLearningPathsToBlob = (rows: Row[] = []) => rows.map((r) => mapLearningPathRowToBlob(r));
