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

// Projekt-Detail-Tabs (Bug-Hunt 7: Routen-Sweep allein ließ ProjectTabs ungeprüft —
// dort saßen 4 Kontrast-Verstöße). Fixture-Projekt wird in den Blob injiziert,
// damit die Tabs echte Inhalte (Beträge, Chips, Tabellen) rendern.
const PROJECT_TABS = ['Übersicht', 'Aufgaben', 'Burndown', 'Material', 'Anforderungen', 'Dokumentation', 'Netzplan', 'Gantt'];

async function injectFixtureProject(page) {
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('azubiboard_v2') || '{}');
    const azubi = (d.users || []).find(u => u.role === 'azubi');
    d.projects = (d.projects || []).filter(p => p.id !== 'proj_a11y');
    d.projects.push({
      id: 'proj_a11y', title: 'a11y-Audit-Projekt', status: 'active', archived: false,
      description: 'Fixture für das Tab-Audit', assignees: azubi ? [azubi.id] : [],
      links: [], calendarEvents: [], comments: [],
      tasks: [
        { id: 't1', text: 'Zuschnitt vorbereiten', status: 'done', done: true, assignee: azubi?.id, deadline: '2026-07-01', timeLog: [{ date: '2026-07-01', hours: 2 }] },
        { id: 't2', text: 'Montage', status: 'in_progress', done: false, assignee: azubi?.id, deadline: '2026-07-10', note: 'Schrauben prüfen' },
      ],
      steps: [
        { id: 's1', title: 'Planung', text: 'Planung', done: true, note: 'Skizze liegt im Ordner' },
        { id: 's2', title: 'Umsetzung', text: 'Umsetzung', done: false },
      ],
      materials: [
        { id: 'm1', name: 'Buchenholz', qty: 2, cost: 12.5 },
        { id: 'm2', name: 'Schrauben 4x40', qty: 1, cost: 3.99 },
      ],
      requirements: [
        { id: 'r1', text: 'Maße nach Zeichnung', done: true },
        { id: 'r2', text: 'Oberfläche geschliffen', done: false },
      ],
      netzplan: { nodes: [], edges: [], unit: 'W', nodePositions: {} },
    });
    localStorage.setItem('azubiboard_v2', JSON.stringify(d));
  });
  await page.goto('/');
  await page.waitForTimeout(600);
}

async function scanProjectTabs(page, prefix, violations) {
  await navigate(page, '/project/proj_a11y');
  await page.waitForTimeout(300);
  for (const t of PROJECT_TABS) {
    await page.getByRole('tab', { name: t }).click();
    await page.waitForTimeout(400);
    await scan(page, `${prefix}:project:${t}`, violations);
  }
}

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
  await injectFixtureProject(page);
  for (const route of ROUTES_AUSBILDER) {
    await navigate(page, route);
    await scan(page, `ausbilder:${route}`, violations);
  }
  await scanProjectTabs(page, 'ausbilder', violations);
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  for (const route of ROUTES_AUSBILDER) {
    await navigate(page, route);
    await scan(page, `ausbilder:dark:${route}`, violations);
  }
  await scanProjectTabs(page, 'ausbilder:dark', violations);

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
