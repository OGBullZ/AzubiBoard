import { useCallback, lazy } from 'react';
import { useAppStore } from '../lib/store';
import type { ShowToast } from '../lib/hooks';
import type { User, AppState } from '../types';

// J13: Code-Splitting — schwergewichtige Route lazy laden.
const GroupsView = lazy(() => import('../features/groups/GroupsView'));

export function GroupsPage({ showToast }: { showToast: ShowToast }) {
  const store = useAppStore();
  const data = store.data as AppState | null;
  const currentUser = store.currentUser as User | null;
  const setData = store.setData;
  // groups: GroupsView-eigener Group-Typ (nicht in types.ts) → any belassen.
  const handleUpdateGroups = useCallback((groups: any) => setData((prev: any) => prev ? { ...prev, groups } : prev), [setData]);
  // groups/projects: GroupsView erwartet eigene Group/GroupProject-Typen (enger als AppState-Blob) → cast.
  return <GroupsView groups={(data?.groups||[]) as any} users={data?.users||[]} projects={(data?.projects||[]) as any} onUpdateGroups={handleUpdateGroups} showToast={showToast} canManage={currentUser?.role === 'ausbilder'} />;
}
