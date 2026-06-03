// ============================================================
//  types.ts — Domain-Typen (Sprint 14 T1)
//
//  Abgeleitet aus den Zod-Schemas in lib/schemas.ts via z.infer.
//  Komponenten importieren diese für ihre Props statt ad-hoc any.
//  Single Source of Truth bleibt schemas.ts.
// ============================================================
import type { z } from 'zod';
import * as S from './lib/schemas';

export type User             = z.infer<typeof S.User>;
export type Task             = z.infer<typeof S.Task>;
export type Requirement      = z.infer<typeof S.Requirement>;
export type Material         = z.infer<typeof S.Material>;
export type Project          = z.infer<typeof S.Project>;
export type Report           = z.infer<typeof S.Report>;
export type CalendarEvent    = z.infer<typeof S.CalendarEvent>;
export type QuizAnswer       = z.infer<typeof S.QuizAnswer>;
export type QuizQuestion     = z.infer<typeof S.QuizQuestion>;
export type LearningPathNode = z.infer<typeof S.LearningPathNode>;
export type LearningPath     = z.infer<typeof S.LearningPath>;
export type SearchResult     = z.infer<typeof S.SearchResult>;
export type AppState         = z.infer<typeof S.AppState>;

export type Role   = User['role'];
export type Id     = string | number;
