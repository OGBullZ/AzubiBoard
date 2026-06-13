// e2e/smoke.spec.js — Boot-Smoke-Gate
//
// Zweck: fängt „Blackscreen"-Regressionen (App bootet, aber wirft zur Laufzeit —
// z.B. Hook außerhalb Router-Kontext), die typecheck/lint/test/build NICHT sehen.
// Strategie: jeder uncaught pageerror = harter Fehler. Zusätzlich werden alle
// Hauptrouten EINGELOGGT durchlaufen (dort schlugen die früheren Blackscreens zu,
// nicht auf der AuthPage).
import { test, expect } from '@playwright/test';

// Erwartbar + harmlos in der Preview (kein App-Defekt). Statische Assets/Icons/Sourcemaps,
// PWA-/SW-Infrastruktur, Sentry (kein DSN), DevTools-Hinweis.
const BENIGN = [
  'favicon', '.ico', '.png', '.jpg', '.jpeg', '.svg', '.webp', '.map',
  'manifest', 'serviceworker', 'service worker', 'workbox', 'sw.js', 'registersw',
  'sentry', 'react devtools', 'preloaded using link preload', 'resizeobserver loop',
];
const isBenign = (s) => BENIGN.some((b) => s.toLowerCase().includes(b));

// Hängt Fehler-Sammler an die Seite. pageerror = uncaught Exception (Blackscreen-Ursache),
// wird nie gefiltert. Fehlgeschlagene Resource-Loads werden über den response-Event mit
// URL erkannt (die generische Konsolenmeldung „Failed to load resource" hat keine URL).
function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(`PAGEERROR: ${err.message}`));
  page.on('console', (m) => {
    const t = m.text();
    // Resource-404 wird via response-Event mit URL behandelt → hier ignorieren (sonst URL-loser Fehlalarm).
    if (m.type() === 'error' && !/failed to load resource/i.test(t) && !isBenign(t)) errors.push(`CONSOLE: ${t}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && !isBenign(r.url())) errors.push(`HTTP ${r.status()}: ${r.url()}`);
  });
  page.on('requestfailed', (r) => {
    if (!isBenign(r.url())) errors.push(`REQFAIL: ${r.url()} ${r.failure()?.errorText}`);
  });
  return errors;
}

// Login über das echte Formular (Demo-Nutzer sind geseedet, PW 1234).
async function login(page, email) {
  await page.goto('/');
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15_000 });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill('1234');
  await page.getByRole('button', { name: /^Anmelden$/ }).click();
  // Authentifizierte Shell ist da, sobald die AuthPage verschwindet.
  await expect(page.locator('input[type="email"]')).toHaveCount(0, { timeout: 15_000 });
}

// Client-seitige SPA-Navigation über den App-Event-Bus (kein Full-Reload).
async function navigate(page, route) {
  await page.evaluate((r) => window.dispatchEvent(new CustomEvent('azubiboard:navigate', { detail: r })), route);
  await page.waitForURL(new RegExp(route.replace('/', '\\/') + '$'), { timeout: 10_000 });
  // Routen sind lazy (Suspense) — kurz auf gerenderten Inhalt warten.
  await expect(page.locator('#root')).not.toBeEmpty();
}

test('Boot ohne JS-Fehler (unauthentifiziert)', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#root')).not.toBeEmpty();
  await page.waitForTimeout(1000);
  expect(errors, `JS-Fehler beim Boot:\n${errors.join('\n')}`).toEqual([]);
});

test('Routen-Sweep eingeloggt als Ausbilder — kein Blackscreen', async ({ page }) => {
  const errors = collectErrors(page);
  await login(page, 'ausbilder@firma.de');
  for (const route of ['/dashboard', '/projects', '/reports', '/calendar', '/groups', '/training', '/learn', '/users', '/profile', '/trash']) {
    await navigate(page, route);
    expect(errors, `JS-Fehler auf ${route}:\n${errors.join('\n')}`).toEqual([]);
  }
});

test('Routen-Sweep eingeloggt als Azubi — kein Blackscreen', async ({ page }) => {
  const errors = collectErrors(page);
  await login(page, 'anna@azubi.de');
  for (const route of ['/dashboard', '/projects', '/reports', '/calendar', '/training', '/learn', '/profile']) {
    await navigate(page, route);
    expect(errors, `JS-Fehler auf ${route}:\n${errors.join('\n')}`).toEqual([]);
  }
});

test('Manifest + Demo-Login im Production-Build verfügbar', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15_000 });
  const manifestUrl = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestUrl).toContain('manifest.webmanifest');
  await expect(page.getByText(/Demo/i).first()).toBeVisible();
});
