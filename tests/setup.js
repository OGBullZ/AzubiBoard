// tests/setup.js — globales Setup für jeden Test-Run.
// Polyfills + Mocks die in jsdom fehlen.

// localStorage ist in jsdom vorhanden, aber zwischen Tests sauber halten:
beforeEach(() => {
  try { localStorage.clear(); sessionStorage.clear(); } catch {}
});

// BroadcastChannel-Stub für jsdom (sonst crashen Module die's importieren).
if (typeof BroadcastChannel === 'undefined') {
  globalThis.BroadcastChannel = class {
    constructor() {}
    postMessage() {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
  };
}
