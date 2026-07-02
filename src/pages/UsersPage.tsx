import { useCallback, lazy } from 'react';
import { useAppStore } from '../lib/store';
import type { ShowToast } from '../lib/hooks';
import type { AppState } from '../types';

// J13: Code-Splitting — schwergewichtige Route lazy laden.
const UsersView = lazy(() => import('../features/users/UsersView'));

export function UsersPage({ showToast }: { showToast: ShowToast }) {
  const store = useAppStore();
  const data = store.data as AppState | null;
  const setData = store.setData;
  // users: UsersView-eigener UserWithAuth-Typ (password etc.) → any belassen.
  const handleUpdate = useCallback((users: any) => setData((prev: any) => prev ? { ...prev, users } : prev), [setData]);
  return <UsersView users={(data?.users || []) as any} onUpdateUsers={handleUpdate} showToast={showToast} />;
}
