// ============================================================
//  schemas.js — T1 Sprint 13: Zod-Schemas für API-Boundaries
//
//  Validiert alle Daten die vom Server kommen, bevor sie in den
//  App-State fließen. Verhindert stille Fehler bei API-Änderungen.
//
//  Verwendung: schemas.Project.safeParse(row)
//  Alle Schemas: safeParse(input) → { success, data, error }
// ============================================================

import { z } from 'zod';

// ── Primitive Helpers ─────────────────────────────────────────
const _idStr   = z.string().min(1); void _idStr;
const optStr   = z.string().optional().nullable();
const optNum   = z.number().optional().nullable();
const isoDate  = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable();
const isoTs    = z.string().optional().nullable();

// ── Auth ──────────────────────────────────────────────────────
export const LoginResponse = z.object({
  token:   z.string().min(10),
  user: z.object({
    id:    z.union([z.string(), z.number()]),
    name:  z.string(),
    email: z.string().email(),
    role:  z.enum(['azubi', 'ausbilder', 'mentor']),
  }),
});

// ── User ─────────────────────────────────────────────────────
export const User = z.object({
  id:                  z.union([z.string(), z.number()]),
  name:                z.string(),
  email:               z.string().email(),
  role:                z.enum(['azubi', 'ausbilder', 'mentor']),
  theme:               z.enum(['dark', 'light']).optional().nullable(),
  avatar_url:          optStr,
  phone:               optStr,
  profession:          optStr,
  company:             optStr,   // Ausbildungsbetrieb (IHK-Stammdaten)
  department:          optStr,   // Ausbildungsabteilung (IHK-Stammdaten)
  apprenticeship_year: z.number().optional().nullable(),
  training_plan:       z.unknown().optional(),
  active:              z.boolean().optional(),
  is_active:           z.boolean().optional(),
});

// ── Label (Blob: an Projekten, referenziert via task.labelIds) ─
export const Label = z.object({
  id:    z.union([z.string(), z.number()]),
  name:  z.string(),
  color: optStr,
});

// ── TimeLog-Eintrag — Union aus relationaler (start/end) und Blob-Form (date/hours) ─
export const TimeLogEntry = z.object({
  id:          z.union([z.string(), z.number()]).optional(),
  start:       optStr,
  end:         optStr,
  description: optStr,
  date:        optStr,
  hours:       optNum,
  userId:      z.union([z.string(), z.number()]).optional().nullable(),
  userName:    optStr,
});

// ── Task ─────────────────────────────────────────────────────
export const Task = z.object({
  id:                 z.union([z.string(), z.number()]),
  text:               z.string().optional(),
  title:              z.string().optional(),
  description:        optStr,
  note:               optStr,
  status:             z.enum(['open','not_started','in_progress','done','blocked','waiting']).optional(),
  priority:           z.enum(['low','medium','high']).optional().nullable(),
  assigned_to:        z.union([z.string(), z.number()]).optional().nullable(),
  due_date:           isoDate,
  estimated_minutes:  optNum,
  completed_at:       isoTs,
  done:               z.boolean().optional(),
  timeLog:            z.array(TimeLogEntry).optional(),
  // Blob-Felder (localStorage-Form, im relationalen Modell anders/abwesend)
  assignee:           z.union([z.string(), z.number()]).optional().nullable(),
  deadline:           isoDate,
  doc:                optStr,
  protocol:           optStr,
  links:              z.array(z.unknown()).optional(),
  labelIds:           z.array(z.union([z.string(), z.number()])).optional(),
  materialRef:        z.array(z.union([z.string(), z.number()])).optional(),
  estimatedHours:     optNum,
  created:            optStr,
  updated_at:         optStr,
  comments:           z.array(z.unknown()).optional(),
});

// ── Requirement + Material ────────────────────────────────────
export const Requirement = z.object({
  id:           z.union([z.string(), z.number()]),
  title:        z.string().optional(),   // relationale Form; Blob nutzt `text`
  description:  optStr,
  done:         z.boolean().optional(),
  priority:     z.string().optional().nullable(),
  completed_at: isoTs,
  // Blob-Form-Alias (localStorage)
  text:         z.string().optional(),
});

export const Material = z.object({
  id:          z.union([z.string(), z.number()]),
  name:        z.string(),
  description: optStr,
  quantity:    optNum,
  unit:        optStr,
  unit_cost:   optNum,
  supplier:    optStr,
  ordered:     z.boolean().optional(),
  // Blob-Form-Aliase (localStorage): qty/cost statt quantity/unit_cost, taskId-Zuordnung
  qty:         optNum,
  cost:        optNum,
  taskId:      z.union([z.string(), z.number()]).optional().nullable(),
});

// ── Project ───────────────────────────────────────────────────
export const Project = z.object({
  id:           z.union([z.string(), z.number()]),
  title:        z.string(),
  description:  optStr,
  user_id:      z.union([z.string(), z.number()]).optional(),
  status:       z.enum(['green','yellow','red']).optional().nullable(),
  priority:     z.enum(['low','medium','high','critical']).optional().nullable(),
  start_date:   isoDate,
  deadline:     isoDate,
  netzplan_unit: z.enum(['W','T','M']).optional().nullable(),
  color:        optStr,
  archived:     z.boolean().optional(),
  tasks:        z.array(Task).optional().default([]),
  requirements: z.array(Requirement).optional().default([]),
  materials:    z.array(Material).optional().default([]),
  // Blob-Felder
  startDate:    isoDate,   // Blob-Alias für start_date (NetzplanGantt liest startDate)
  assignees:    z.array(z.union([z.string(), z.number()])).optional(),
  links:        z.array(z.unknown()).optional(),
  groupId:      z.union([z.string(), z.number()]).optional().nullable(),
  netzplan:     z.unknown().optional(),
  labels:       z.array(Label).optional(),
  steps:        z.array(z.unknown()).optional(),
  comments:     z.array(z.unknown()).optional(),
});

// ── Report ────────────────────────────────────────────────────
export const Report = z.object({
  id:             z.union([z.string(), z.number()]),
  user_id:        z.union([z.string(), z.number()]).optional(),
  reviewer_id:    z.union([z.string(), z.number()]).optional().nullable(),
  week_start:     isoDate,
  week_number:    optNum,
  year:           optNum,
  title:          optStr,
  activities:     optStr,
  learnings:      optStr,
  // Optionale Tagesstruktur (Mo–Fr) als IHK-Tagesform — Alternative zum Freitext.
  days:           z.record(z.string(), z.object({ text: optStr, hours: optNum })).optional(),
  status:         z.enum(['draft','submitted','reviewed','signed']).optional(),
  submitted_at:   isoTs,
  reviewed_at:    isoTs,
  signed_at:      isoTs,
  review_comment: optStr,
  reviewer_comment: optStr,
  // Blob-Felder, beim Speichern angehängt (nicht im relationalen Modell)
  user_name:      optStr,
  created_at:     isoTs,
  updated_at:     isoTs,
  // file kann String (Pfad/URL) ODER hochgeladenes Objekt sein
  file:           z.union([z.string(), z.object({ name: z.string(), size: optNum, type: optStr, data: optStr })]).optional().nullable(),
  // sectionComments: { activities: Comment[], learnings: Comment[] }
  sectionComments: z.record(z.string(), z.array(z.unknown())).optional(),
});

// ── Search Result ─────────────────────────────────────────────
export const SearchResult = z.object({
  type:  z.string(),
  label: z.string(),
  sub:   optStr,
  to:    z.string(),
  icon:  z.string().optional(),
  score: z.number().optional(),
});

export const SearchResponse = z.object({
  results: z.array(SearchResult),
  query:   z.string(),
});

// ── Calendar Event ────────────────────────────────────────────
export const CalendarEvent = z.object({
  id:        z.union([z.string(), z.number()]),
  date:      isoDate,
  title:     z.string(),
  note:      optStr,
  projectId: z.union([z.string(), z.number()]).optional().nullable(),
  type:      z.enum(['event','deadline','reminder','untis','holiday']).optional(),
  color:     optStr,
});

// ── Quiz ──────────────────────────────────────────────────────
export const QuizAnswer = z.object({
  id:      z.union([z.string(), z.number()]),
  text:    z.string(),
  correct: z.boolean().optional(),
});

export const QuizQuestion = z.object({
  id:       z.union([z.string(), z.number()]),
  question: z.string(),
  category: z.string().optional(),
  type:     z.enum(['single','multiple','text']).optional(),
  answers:  z.array(QuizAnswer).optional().default([]),
});

// ── Learning Path ─────────────────────────────────────────────
export const LearningPathNode = z.object({
  id:          z.union([z.string(), z.number()]),
  title:       z.string(),
  description: optStr,
  type:        z.enum(['article','link','quiz','task']).optional(),
  content:     optStr,
  prereqs:     z.array(z.union([z.string(), z.number()])).optional().default([]),
});

export const LearningPath = z.object({
  id:          z.union([z.string(), z.number()]),
  title:       z.string(),
  description: optStr,
  lehrjahr:    z.number().optional().nullable(),
  nodes:       z.array(LearningPathNode).optional().default([]),
});

// ── Trainingsplan-Lernziel (Blob) ─────────────────────────────
export const TrainingGoalProgress = z.object({
  status:      z.enum(['open', 'learned', 'confirmed']).optional(),
  ts:          optStr,
  confirmedBy: z.union([z.string(), z.number()]).optional().nullable(),
  confirmedTs: optStr,
});

export const TrainingGoal = z.object({
  id:          z.union([z.string(), z.number()]),
  title:       z.string(),
  description: optStr,
  year:        optNum,
  quarter:     optNum,
  category:    optStr,
  progress:    z.record(z.string(), TrainingGoalProgress).optional().default({}),
});

// ── App-State (vollständig) ───────────────────────────────────
export const AppState = z.object({
  schema_version: z.number().optional(),
  users:          z.array(User).optional().default([]),
  projects:       z.array(Project).optional().default([]),
  reports:        z.array(Report).optional().default([]),
  calendarEvents: z.array(CalendarEvent).optional().default([]),
  quizzes:        z.array(QuizQuestion).optional().default([]),
  learningPaths:  z.array(LearningPath).optional().default([]),
  pathProgress:   z.record(z.string(), z.object({ completed: z.boolean(), completed_at: isoTs })).optional().default({}),
  trainingPlan:   z.object({
    goals:    z.array(z.unknown()).optional().default([]),
    examDate: optStr,
  }).optional(),
  groups:         z.array(z.unknown()).optional().default([]),
  trash:          z.unknown().optional(),
  activityLog:    z.array(z.unknown()).optional().default([]),
}).passthrough();

// ── Validate Helper ───────────────────────────────────────────
// Gibt data zurück (ggf. partial) und loggt Fehler im Development.
export function validate<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
  context = '',
): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success && import.meta.env.DEV) {
    console.warn(`[schema] Validierungsfehler${context ? ` in ${context}` : ''}:`, result.error.flatten());
  }
  return result.success ? result.data : (data as z.infer<T>);
}
