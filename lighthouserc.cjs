// lighthouserc.cjs — Lighthouse-CI Konfiguration
// Audits gegen das Production-Bundle (vite preview auf :4173).
// Schwellen sind initial moderat — sollen mit der Zeit verschärft werden.
module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:4173/azubiboard/'],
      numberOfRuns: 1,
      settings: {
        // Auth-Page ist alles, was wir ohne Login erreichen — als Baseline OK
        preset: 'desktop',
        chromeFlags: '--no-sandbox',
        // Vite-Preview liefert PWA-Manifest+SW → PWA-Audit ist relevant
      },
    },
    assert: {
      // Q2 Sprint 13: accessibility + best-practices sind jetzt blocking (error).
      // performance bleibt warn (von Netz/CPU des CI-Runners abhängig).
      assertions: {
        'categories:performance':    ['warn',  { minScore: 0.80 }],
        'categories:accessibility':  ['error', { minScore: 0.88 }],
        'categories:best-practices': ['error', { minScore: 0.88 }],
        'categories:seo':            ['error', { minScore: 0.80 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
