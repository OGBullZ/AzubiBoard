// ============================================================
//  trash.js – Soft-Delete + Papierkorb
//  Statt harten `filter()`-Kills landen Löschungen für 30 Tage
//  in data.trash. Restore und permanentes Löschen via UI.
// ============================================================

const MAX_AGE_DAYS = 30;
// type → collection key in data
export const TRASH_TYPES = ['projects', 'reports', 'goals'];

function emptyBin() {
  return { projects: [], reports: [], goals: [] };
}

export function ensureTrash(data) {
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
export function softDelete(data, type, item, currentUser) {
  if (!TRASH_TYPES.includes(type)) throw new Error(`Unknown trash type: ${type}`);
  if (!item || !item.id)            throw new Error('Item ohne id');
  const next = ensureTrash(data);
  const trashEntry = {
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
    [type]: (next[type] || []).filter(x => x.id !== item.id),
    trash:  { ...next.trash, [type]: [trashEntry, ...next.trash[type]] },
  };
}

// Wiederherstellen: aus trash entfernen, in Original-Collection zurück
export function restoreFromTrash(data, type, id) {
  const next  = ensureTrash(data);
  const entry = next.trash[type].find(e => e.id === id);
  if (!entry) return next;
  // deletedAt-Felder vor Restore wegputzen
  const { deletedAt, deletedBy, deletedByName, ...clean } = entry;
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
    [type]: [...(next[type] || []), clean],
    trash:  { ...next.trash, [type]: next.trash[type].filter(e => e.id !== id) },
  };
}

// Permanent löschen: aus trash entfernen ohne Restore
export function purgeFromTrash(data, type, id) {
  const next = ensureTrash(data);
  return { ...next, trash: { ...next.trash, [type]: next.trash[type].filter(e => e.id !== id) } };
}

// Auto-Cleanup: Einträge älter als MAX_AGE_DAYS rauswerfen
export function autoCleanTrash(data, maxAgeDays = MAX_AGE_DAYS) {
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

export function trashCount(data) {
  if (!data?.trash) return 0;
  return TRASH_TYPES.reduce((s, k) => s + (data.trash[k]?.length || 0), 0);
}
