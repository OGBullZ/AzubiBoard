// e2e/a11y.spec.js — a11y-Gate (Pass 3, 2026-07-02)
//
// axe-core (WCAG 2.0 A + AA) über alle Hauptrouten, beide Themes, beide Rollen.
// Stand Pass 3: 0 Violations — dieses Gate hält den Stand. Wer hier reinläuft:
// Kontrast-Töne stehen als Token in index.css (--c-mu, --c-*-text, --c-on-ac, --stamp-*);
// Akzent/Status ALS TEXT immer über C.acT/grT/crT/ywT (nicht C.ac & Co) setzen.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function login(page, email) {
  await page.goto('/');
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15_000 });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill('1234');
  await page.getByRole('button', { name: /^Anmelden$/ }).click();
  await expect(page.locator('input[type="email"]')).toHaveCount(0, { timeout: 15_000 });
  // Onboarding/News unterdrücken — Audit misst die Arbeitsoberfläche
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('azubiboard_v2') || '{}');
    for (const u of d.users || []) {
      localStorage.setItem(`azubiboard_onboarded_${u.id}`, '1');
      localStorage.setItem(`azubiboard_news_seen_${u.id}`, new Date().toDateString());
    }
  });
  await page.goto('/');
  await page.waitForTimeout(600);
}

async function scan(page, label, violations) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  for (const v of r.violations) {
    violations.push(`[${label}] ${v.id} (${v.impact}, ${v.nodes.length} Nodes): ${v.help}` +
      v.nodes.slice(0, 3).map(n => `\n    ${(n.target || []).join(' ')}`).join(''));
  }
}

async function navigate(page, route) {
  await page.evaluate((r) => window.dispatchEvent(new CustomEvent('azubiboard:navigate', { detail: r })), route);
  await page.waitForTimeout(500);
}

const ROUTES_AUSBILDER = ['/dashboard', '/projects', '/reports', '/calendar', '/groups', '/training', '/learn', '/users', '/profile', '/trash'];
const ROUTES_AZUBI = ['/dashboard', '/reports', '/training', '/learn'];

test('axe: alle Routen ohne WCAG-A/AA-Violations (Light + Dark, Ausbilder + Azubi)', async ({ page }) => {
  test.setTimeout(180_000);
  // Einlauf-Animationen (draft-in/draw-in/fadeUp) verfälschen sonst die Farb-Messung (opacity mid-flight)
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const violations = [];

  // AuthPage — Inline-fadeUp (.3s) austicken lassen
  await page.goto('/');
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(900);
  await scan(page, 'auth', violations);

  // Ausbilder: Light (Headless-OS-Default) + Dark
  await login(page, 'ausbilder@firma.de');
  for (const route of ROUTES_AUSBILDER) {
    await navigate(page, route);
    await scan(page, `ausbilder:${route}`, violations);
  }
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  for (const route of ROUTES_AUSBILDER) {
    await navigate(page, route);
    await scan(page, `ausbilder:dark:${route}`, violations);
  }

  // Azubi (frische Session)
  await page.evaluate(() => sessionStorage.clear());
  await page.goto('/');
  await login(page, 'anna@azubi.de');
  for (const route of ROUTES_AZUBI) {
    await navigate(page, route);
    await scan(page, `azubi:${route}`, violations);
  }

  expect(violations, `axe-Violations:\n${violations.join('\n')}`).toEqual([]);
});
