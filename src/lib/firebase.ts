// Firebase-Initialisierung (Hosting-Projekt azubiboard-1fc20).
// Web-Config ist public by design — Zugriffskontrolle passiert über Firebase-Regeln, nicht den Key.
import { initializeApp } from 'firebase/app'
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics'

const firebaseConfig = {
  apiKey: 'AIzaSyDFrmWmd1eWsf1P2Sy6Xc0jIOdOSEBzXbg',
  authDomain: 'azubiboard-1fc20.firebaseapp.com',
  projectId: 'azubiboard-1fc20',
  storageBucket: 'azubiboard-1fc20.firebasestorage.app',
  messagingSenderId: '806094994738',
  appId: '1:806094994738:web:d2624ff756ee01626f2b2b',
  measurementId: 'G-WKT7DKCCX7',
}

export const firebaseApp = initializeApp(firebaseConfig)

// Kein Top-Level-Await: isSupported() ist async (z.B. false in Brave/Private-Mode),
// Analytics darf den App-Start nie blockieren oder brechen.
export let firebaseAnalytics: Analytics | null = null
isSupported()
  .then((ok) => {
    if (ok) firebaseAnalytics = getAnalytics(firebaseApp)
  })
  .catch(() => {
    /* Analytics nicht verfügbar — App läuft normal weiter */
  })
