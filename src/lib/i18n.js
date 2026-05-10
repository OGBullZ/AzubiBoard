// ============================================================
//  i18n.js – Internationalisierungs-Setup (react-i18next)
//  Default: Deutsch. Englisch als Stub vorhanden, kann
//  inkrementell befüllt werden.
//
//  Strategie: Strings werden NICHT auf einmal migriert.
//  Wer in einer Komponente t() braucht: useTranslation(),
//  Schlüssel anlegen, beide Sprachen pflegen.
// ============================================================
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import de from '../locales/de.json';
import en from '../locales/en.json';

const STORAGE_KEY = 'azubiboard_lang';

function detectLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && ['de', 'en'].includes(saved)) return saved;
  } catch {}
  // Browser-Hinweis, Fallback auf de (Hauptzielgruppe)
  const nav = (typeof navigator !== 'undefined' && navigator.language) || 'de';
  return nav.toLowerCase().startsWith('en') ? 'en' : 'de';
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      de: { translation: de },
      en: { translation: en },
    },
    lng:           detectLang(),
    fallbackLng:   'de',
    interpolation: { escapeValue: false }, // React escaped selbst
    returnEmptyString: false,
  });

export function setLanguage(lng) {
  if (!['de', 'en'].includes(lng)) return;
  i18n.changeLanguage(lng);
  try { localStorage.setItem(STORAGE_KEY, lng); } catch {}
}

export default i18n;
