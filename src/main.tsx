import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
// Design D1: self-hosted Fonts (CSP-konform, PWA-offline) — nur benötigte Schnitte
import '@fontsource/chakra-petch/600.css'
import '@fontsource/chakra-petch/700.css'
import '@fontsource-variable/archivo/index.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/700.css'
import './index.css'
import './lib/i18n.js' // Side-Effect: i18next-Instance initialisieren
import { initSentry } from './lib/sentry.js'

// L3: Sentry initialisieren BEVOR React rendert, damit Boot-Errors gefangen werden.
// No-Op wenn VITE_SENTRY_DSN nicht gesetzt ist.
initSentry();

// Design-Version vor dem ersten Paint anwenden (1.0 = Default, '1.0 Beta' = Werkbank-Redesign).
// Umschalter in ProfilePage; gleiche Mechanik wie data-theme.
try {
  document.documentElement.setAttribute('data-design', localStorage.getItem('azubiboard_design') || 'v1');
} catch { /* noop */ }

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
