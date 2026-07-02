import { lazy } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../lib/store';
import { sameId } from '../lib/utils';
import type { User, AppState } from '../types';

// J13: Code-Splitting — schwergewichtige Route lazy laden.
const AzubiProfilePage = lazy(() => import('../features/users/AzubiProfilePage'));

export function AzubiProfileWrapper() {
  const { id } = useParams();
  const navigate = useNavigate();
  const store = useAppStore();
  const data = store.data as AppState | null;
  const currentUser = store.currentUser as User | null;
  const azubi = (data?.users || []).find((u: User) => sameId(u.id, id));
  // data-Prop bleibt locker: AzubiProfilePage erwartet eigenen ProfileData-Typ, nicht AppState.
  return <AzubiProfilePage azubi={azubi} data={data as any} currentUser={currentUser} onBack={() => navigate(-1)} />;
}
