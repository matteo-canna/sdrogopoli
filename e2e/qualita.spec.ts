// Qualità grafica: si sceglie nelle impostazioni e vale subito, anche dopo aver ricaricato.
import { expect, test } from '@playwright/test';
import { apri, nuovaPartita } from './aiuti';

test('la qualità grafica si sceglie e resta', async ({ page }, info) => {
  test.skip(info.project.name === 'telefono', 'basta il computer');
  const errori: string[] = [];
  page.on('pageerror', (e) => errori.push(e.message));
  await apri(page, { 'sdrogopoli-vista': '3d', 'sdrogopoli-velocita': 'istantanea' });
  await nuovaPartita(page);
  await expect(page.locator('.board3d canvas')).toBeVisible({ timeout: 30_000 });

  await page.click('[data-action=settings]');
  const finestra = page.locator('.settings-dialog');
  await expect(finestra).toContainText('Qualità grafica');
  await finestra.locator('input[name=quality][value=bassa]').check();
  await finestra.locator('button.primary').click();
  // la scena è ancora lì e la scelta è salvata
  await expect(page.locator('.board3d canvas')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sdrogopoli-impostazioni') ?? '{}').quality)).toBe('bassa');

  await page.reload();
  await page.click('[data-resume]');
  await expect(page.locator('.board3d canvas')).toBeVisible({ timeout: 30_000 });
  await page.click('[data-action=settings]');
  await expect(page.locator('.settings-dialog input[name=quality][value=bassa]')).toBeChecked();
  expect(errori).toEqual([]);
});
