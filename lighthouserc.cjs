// lighthouserc.cjs — Lighthouse-CI Konfiguration
// Audits gegen das Production-Bundle (vite preview auf :4173).
module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:4173/azubiboard/'],
      // P4 (2026-07-02): 3 Runs → Median glättet CI-Runner-Varianz, erlaubt Perf als hartes Gate
      numberOfRuns: 3,
      settings: {
        // Auth-Page ist alles, was wir ohne Login erreichen — als Baseline OK
        preset: 'desktop',
        chromeFlags: '--no-sandbox',
        // Vite-Preview liefert PWA-Manifest+SW → PWA-Audit ist relevant
      },
    },
    assert: {
      // P4 (2026-07-02): alle 4 Kategorien blocking. Lokale Baseline: 1.0/1.0/1.0/1.0
      // (a11y Pass 3 + Meta-Description). Schwellen mit Headroom für langsame CI-Runner.
      assertions: {
        'categories:performance':    ['error', { minScore: 0.90 }],
        'categories:accessibility':  ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.95 }],
        'categories:seo':            ['error', { minScore: 0.90 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
