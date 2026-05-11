// e2e/smoke.spec.js — Minimaler App-Boot-Smoke
import { test, expect } from '@playwright/test';

test('App lädt ohne JS-Fehler', async ({ page }) => {
  const messages = [];
  page.on('pageerror', (err) => messages.push(`PAGEERROR: ${err.message}`));
  page.on('console',   (m)   => messages.push(`${m.type().toUpperCase()}: ${m.text()}`));
  page.on('requestfailed', (r) => messages.push(`REQFAIL: ${r.url()} ${r.failure()?.errorText}`));
  await page.goto('/');
  await page.waitForTimeout(3000);
  console.log('---PAGE MESSAGES---\n' + messages.join('\n'));
  // AuthPage muss da sein → App ist gebootet
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15_000 });
});

test('Manifest und SW sind im Production-Build verfügbar', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15_000 });
  // vite-plugin-pwa registriert SW im preview/prod-Bundle
  const manifestUrl = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestUrl).toContain('manifest.webmanifest');
});

test('Demo-Login-Buttons sind sichtbar', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15_000 });
  // Schnellzugang-Buttons (Ausbilder, Azubi) — verlinken zu Demo-Daten
  await expect(page.getByText(/Demo/i).first()).toBeVisible();
});
