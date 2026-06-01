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
  apprenticeship_year: z.number().optional().nullable(),
  training_plan:       z.unknown().optional(),
});

// ── Task ─────────────────────────────────────────────────────
export const Task = z.object({
  id:                 z.union([z.string(), z.number()]),
  text:               z.string().optional(),
  title:              z.string().optional(),
  description:        optStr,
  note:               optStr,
  status:             z.enum(['open','in_progress','done','blocked','waiting']).optional(),
  priority:           z.enum(['low','medium','high']).optional().nullable(),
  assigned_to:        z.union([z.string(), z.number()]).optional().nullable(),
  due_date:           isoDate,
  estimated_minutes:  optNum,
  completed_at:       isoTs,
  done:               z.boolean().optional(),
  timeLog:            z.array(z.object({ start: optStr, end: optStr, description: optStr })).optional(),
});

// ── Requirement + Material ────────────────────────────────────
export const Requirement = z.object({
  id:           z.union([z.string(), z.number()]),
  title:        z.string(),
  description:  optStr,
  done:         z.boolean().optional(),
  priority:     z.string().optional().nullable(),
  completed_at: isoTs,
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
  status:         z.enum(['draft','submitted','reviewed','signed']).optional(),
  submitted_at:   isoTs,
  reviewed_at:    isoTs,
  signed_at:      isoTs,
  review_comment: optStr,
  file:           optStr,
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

// ── App-State (vollständig) ───────────────────────────────────
export const AppState = z.object({
  schema_version: z.number().optional(),
  users:          z.array(User).optional().default([]),
  projects:       z.array(Project).optional().default([]),
  reports:        z.array(Report).optional().default([]),
  calendarEvents: z.array(CalendarEvent).optional().default([]),
  quizzes:        z.array(QuizQuestion).optional().default([]),
  learningPaths:  z.array(LearningPath).optional().default([]),
  pathProgress:   z.record(z.object({ completed: z.boolean(), completed_at: isoTs })).optional().default({}),
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
export function validate(schema, data, context = '') {
  const result = schema.safeParse(data);
  if (!result.success && import.meta.env.DEV) {
    console.warn(`[schema] Validierungsfehler${context ? ` in ${context}` : ''}:`, result.error.flatten());
  }
  return result.success ? result.data : data;
}
