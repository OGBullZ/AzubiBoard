// ============================================================
//  trash.ts – Soft-Delete + Papierkorb  (T1 Sprint 14: js → ts)
//  Statt harten `filter()`-Kills landen Löschungen für 30 Tage
//  in data.trash. Restore und permanentes Löschen via UI.
// ============================================================

const MAX_AGE_DAYS = 30;

export type TrashType = 'projects' | 'reports' | 'goals';

// type → collection key in data
export const TRASH_TYPES: TrashType[] = ['projects', 'reports', 'goals'];

interface Identified { id: string | number; [k: string]: unknown; }
type TrashEntry = Identified & {
  deletedAt?: string;
  deletedBy?: string | number | null;
  deletedByName?: string | null;
};
type TrashBin = Record<TrashType, TrashEntry[]>;

interface TrainingPlan { goals?: Identified[]; examDate?: string | null; [k: string]: unknown; }

interface AppData {
  trash?: TrashBin;
  trainingPlan?: TrainingPlan;
  [k: string]: unknown;
}

// `next` nach ensureTrash hat garantiert ein vollständiges Bin
type WithTrash = AppData & { trash: TrashBin };

interface CurrentUser { id?: string | number; name?: string; [k: string]: unknown; }

function emptyBin(): TrashBin {
  return { projects: [], reports: [], goals: [] };
}

export function ensureTrash(data: AppData): WithTrash {
  // Migration: data.trash existiert evtl. nicht — leeres Bin anlegen
  if (!data.trash || typeof data.trash !== 'object') {
    return { ...data, trash: emptyBin() };
  }
  const bin = emptyBin();
  for (const k of TRASH_TYPES) {
    bin[k] = Array.isArray(data.trash[k]) ? data.trash[k] : [];
  }
  return { ...data, trash: bin };
}

// type: 'projects' | 'reports' | 'goals'
// item: das zu löschende Objekt (mit .id)
// currentUser: für deletedBy
export function softDelete(data: AppData, type: TrashType, item: Identified, currentUser?: CurrentUser | null): WithTrash {
  if (!TRASH_TYPES.includes(type)) throw new Error(`Unknown trash type: ${type}`);
  if (!item || !item.id)            throw new Error('Item ohne id');
  const next = ensureTrash(data);
  const trashEntry: TrashEntry = {
    ...item,
    deletedAt:    new Date().toISOString(),
    deletedBy:    currentUser?.id || null,
    deletedByName: currentUser?.name || null,
  };
  if (type === 'goals') {
    // Lernziele leben in data.trainingPlan.goals
    const plan  = next.trainingPlan || { goals: [], examDate: null };
    const goals = (plan.goals || []).filter(g => g.id !== item.id);
    return {
      ...next,
      trainingPlan: { ...plan, goals },
      trash: { ...next.trash, goals: [trashEntry, ...next.trash.goals] },
    };
  }
  return {
    ...next,
    [type]: ((next[type] as Identified[]) || []).filter(x => x.id !== item.id),
    trash:  { ...next.trash, [type]: [trashEntry, ...next.trash[type]] },
  };
}

// Wiederherstellen: aus trash entfernen, in Original-Collection zurück
export function restoreFromTrash(data: AppData, type: TrashType, id: string | number): WithTrash {
  const next  = ensureTrash(data);
  const entry = next.trash[type].find(e => e.id === id);
  if (!entry) return next;
  // deletedAt-Felder vor Restore wegputzen
  const { deletedAt, deletedBy, deletedByName, ...clean } = entry;
  void deletedAt; void deletedBy; void deletedByName;
  if (type === 'goals') {
    const plan = next.trainingPlan || { goals: [], examDate: null };
    return {
      ...next,
      trainingPlan: { ...plan, goals: [...(plan.goals || []), clean] },
      trash:        { ...next.trash, goals: next.trash.goals.filter(e => e.id !== id) },
    };
  }
  return {
    ...next,
    [type]: [...((next[type] as Identified[]) || []), clean],
    trash:  { ...next.trash, [type]: next.trash[type].filter(e => e.id !== id) },
  };
}

// Permanent löschen: aus trash entfernen ohne Restore
export function purgeFromTrash(data: AppData, type: TrashType, id: string | number): WithTrash {
  const next = ensureTrash(data);
  return { ...next, trash: { ...next.trash, [type]: next.trash[type].filter(e => e.id !== id) } };
}

// Auto-Cleanup: Einträge älter als MAX_AGE_DAYS rauswerfen
export function autoCleanTrash(data: AppData, maxAgeDays = MAX_AGE_DAYS): WithTrash {
  const cutoff = Date.now() - maxAgeDays * 86_400_000;
  const next   = ensureTrash(data);
  let changed  = false;
  const bin    = emptyBin();
  for (const k of TRASH_TYPES) {
    const before = next.trash[k] || [];
    const after  = before.filter(e => {
      const t = e.deletedAt ? new Date(e.deletedAt).getTime() : Date.now();
      return t >= cutoff;
    });
    if (after.length !== before.length) changed = true;
    bin[k] = after;
  }
  return changed ? { ...next, trash: bin } : next;
}

export function trashCount(data?: AppData | null): number {
  if (!data?.trash) return 0;
  return TRASH_TYPES.reduce((s, k) => s + (data.trash?.[k]?.length || 0), 0);
}
