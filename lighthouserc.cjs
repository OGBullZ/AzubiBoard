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
      // Non-blocking Schwellen: PR scheitert NICHT, aber Werte werden geloggt.
      // Auf "error" hochstufen, wenn die App stabil über den Werten liegt.
      assertions: {
        'categories:performance':   ['warn', { minScore: 0.85 }],
        'categories:accessibility': ['warn', { minScore: 0.90 }],
        'categories:best-practices': ['warn', { minScore: 0.90 }],
        'categories:seo':           ['warn', { minScore: 0.85 }],
        // PWA wird in neueren Lighthouse-Versionen separat getestet
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
