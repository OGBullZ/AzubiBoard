import { useState, useEffect, useCallback } from 'react';
import { dataService } from '../lib/dataService';
import { today, uid, sameId } from '../lib/utils';
import type { ShowToast } from '../lib/hooks';
import type { User, Id } from '../types';

const USE_API = import.meta.env.VITE_USE_API === 'true';

// ── UX1: Onboarding-Wizard + Willkommens-/News-Fenster (Sichtbarkeit + Wizard-Handler) ──
export function useOnboardingFlow(
  currentUser: User | null,
  setCurrentUser: (u: User | null) => void,
  setData: (d: any) => void,
  showToast: ShowToast,
) {
  const [showOnboarding, setShowOnboarding] = useState(false); // UX1
  const [showNews, setShowNews] = useState(false); // Willkommens-/News-Fenster (1×/Tag bei echtem Login)

  // UX1: Onboarding beim ersten Login anzeigen (localStorage-Flag pro User)
  useEffect(() => {
    if (!currentUser?.id) return;
    const key = `azubiboard_onboarded_${currentUser.id}`;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Modal-Sichtbarkeit wird bewusst vom Login-Wechsel abgeleitet
    if (!localStorage.getItem(key)) setShowOnboarding(true);
  }, [currentUser?.id]);

  // Willkommens-/News-Fenster: max. 1×/Tag, NUR bei echtem Login (nicht bei Reload).
  // Entscheidungsbaum (WELCOME-FENSTER-DESIGN.md §2.2):
  // fresh-Login-Marker (sessionStorage, nur von handleLogin gesetzt) trennt Login von Reload.
  useEffect(() => {
    if (!currentUser?.id) return;
    const id = String(currentUser.id);
    let fresh: string | null = null;
    try { fresh = sessionStorage.getItem('azubiboard_fresh_login'); } catch { /* noop */ }
    if (fresh !== id) return;                                      // Reload/Restore → nichts zeigen
    try { sessionStorage.removeItem('azubiboard_fresh_login'); } catch { /* noop */ }  // Marker konsumieren
    if (!localStorage.getItem(`azubiboard_onboarded_${id}`)) return; // erster Login → Onboarding hat Vorrang
    try {
      if (localStorage.getItem(`azubiboard_news_seen_${id}`) === today()) return;       // heute schon gesehen
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Modal-Sichtbarkeit wird bewusst vom Login-Wechsel abgeleitet
    setShowNews(true);
  }, [currentUser?.id]);
  // UX1: Custom-Event aus ProfilePage erlaubt "Onboarding erneut anzeigen"
  useEffect(() => {
    const fn = () => setShowOnboarding(true);
    window.addEventListener('azubiboard:show-onboarding', fn);
    return () => window.removeEventListener('azubiboard:show-onboarding', fn);
  }, []);
  // Q5: News-Fenster manuell wiederöffnen (ProfilePage) — unabhängig vom 1×/Tag-Gate
  useEffect(() => {
    const fn = () => setShowNews(true);
    window.addEventListener('azubiboard:show-news', fn);
    return () => window.removeEventListener('azubiboard:show-news', fn);
  }, []);

  // userId lokal heben: optional-chained deps ([currentUser?.id]) kann der
  // React-Compiler-Lint nicht als manuelle Memoization erhalten.
  const userId = currentUser?.id;

  const doneOnboarding = useCallback(() => {
    if (userId) localStorage.setItem(`azubiboard_onboarded_${userId}`, '1');
    setShowOnboarding(false);
  }, [userId]);

  const closeNews = useCallback(() => {
    if (userId) {
      try { localStorage.setItem(`azubiboard_news_seen_${userId}`, today()); } catch { /* noop */ }
    }
    setShowNews(false);
  }, [userId]);

  // ── Onboarding-Wizard-Handler (Phase 3: rollenspezifische Setup-Schritte) ──
  // Profil aktualisieren (Azubi-Schritt 2): wie AzubiProfilePage — API + Blob + currentUser.
  const handleUpdateProfile = useCallback((changes: Partial<User>) => {
    if (!currentUser?.id) return;
    if (USE_API) dataService.updateProfile(changes).catch(() => showToast('⚠ Profil konnte nicht zum Server synchronisiert werden'));
    setCurrentUser({ ...currentUser, ...changes });
    // prev: Store-Blob (Boundary) → any.
    setData((prev: any) => prev ? { ...prev, users: (prev.users || []).map((u: User) => sameId(u.id, currentUser.id) ? { ...u, ...changes } : u) } : prev);
  }, [currentUser, setCurrentUser, setData, showToast]);

  // Beitritts-Anfrage an eine Gruppe (Azubi-Schritt 3): schreibt currentUser.id in group.requests.
  // Der Ausbilder bestätigt sie später in der Gruppen-Verwaltung.
  const handleRequestGroup = useCallback((groupId: Id) => {
    if (!currentUser?.id) return;
    setData((prev: any) => prev ? { ...prev, groups: (prev.groups || []).map((g: any) =>
      g.id === groupId && ![...(g.members || []), ...(g.requests || [])].some((x: Id) => sameId(x, currentUser.id))
        ? { ...g, requests: [...(g.requests || []), currentUser.id] } : g) } : prev);
  }, [currentUser, setData]);

  // Erste Gruppe anlegen (Ausbilder-Schritt 2): Gruppe ohne Code, Azubis treten per Anfrage bei.
  const handleCreateGroup = useCallback((name: string, type: string) => {
    const newGroup = { id: uid(), name: name.trim(), type, members: [], requests: [] };
    setData((prev: any) => prev ? { ...prev, groups: [...(prev.groups || []), newGroup] } : prev);
  }, [setData]);

  return { showOnboarding, showNews, doneOnboarding, closeNews, handleUpdateProfile, handleRequestGroup, handleCreateGroup };
}
