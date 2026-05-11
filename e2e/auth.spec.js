// e2e/auth.spec.js — App-Boot + AuthPage render
import { test, expect } from '@playwright/test';

test('App rendert AuthPage beim ersten Besuch', async ({ page }) => {
  await page.goto('/');
  // Eingabefelder müssen erscheinen
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('input[type="password"]')).toBeVisible();
  // Login/Register-Tabs
  await expect(page.getByRole('tab', { name: /Anmelden/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Registrieren/ })).toBeVisible();
});

test('Tab-Wechsel zu Registrieren zeigt Namens-Feld', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('tab', { name: /Registrieren/ }).click();
  await expect(page.locator('input#reg-name')).toBeVisible();
  // Passwort-Hinweis "Mindestens 8 Zeichen"
  await expect(page.getByText(/mindestens 8 Zeichen/i)).toBeVisible();
});

test('Login mit falschen Daten zeigt Fehlermeldung', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15_000 });
  await page.locator('input[type="email"]').fill('nicht@existiert.de');
  await page.locator('input[type="password"]').fill('falschesPW');
  await page.getByRole('button', { name: /^Anmelden$/ }).click();
  // Irgendeine Fehlermeldung (Text in role="alert")
  await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 5000 });
});
