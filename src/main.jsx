import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './lib/i18n.js' // Side-Effect: i18next-Instance initialisieren
import { initSentry } from './lib/sentry.js'

// L3: Sentry initialisieren BEVOR React rendert, damit Boot-Errors gefangen werden.
// No-Op wenn VITE_SENTRY_DSN nicht gesetzt ist.
initSentry();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
