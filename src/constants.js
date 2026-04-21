// ============================================================
//  constants.js – App-Konfiguration
//  Pfad: src/lib/constants.js
// ============================================================

// Auf true setzen wenn PHP-Backend läuft (XAMPP),
// auf false für reine localStorage-Demo
export const USE_API = false;

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost/azubiboard/api';
