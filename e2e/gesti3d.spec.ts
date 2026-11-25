// Tabellone 3D: rotella, trascinamento e tastiera muovono la camera; "Torna alla pedina" rimette la vista;
// la casella scelta (o sotto il mouse) ha il suo cartellino.
import { expect, test } from '@playwright/test';
import { apri, nuovaPartita } from './aiuti';

test('gesti e cartellino nel 3D', async ({ page }, info) => {
  test.skip(info.project.name === 'telefono', 'il pizzico non si simula: si prova il mouse sul computer');
  const errori: string[] = [];
  page.on('pageerror', (e) => errori.push(e.message));
  await apri(page, { 'sdrogopoli-vista': '3d', 'sdrogopoli-velocita': 'istantanea' });
  await nuovaPartita(page);
  const tabellone = page.locator('.board3d');
  const canvas = tabellone.locator('canvas');
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  const torna = tabellone.locator('.view3d-reset');
  await expect(torna).toBeHidden();

  // rotella: ci si avvicina e compare il pulsante per tornare
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -400);
  await expect(torna).toBeVisible();
  await expect(torna).toContainText('Torna alla pedina');
  await torna.click();
  await expect(torna).toBeHidden();

  // trascinare gira la camera, e non sceglie caselle
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(torna).toBeVisible();
  await expect(page.locator('.space-card')).toHaveCount(0);

  // dalla tastiera: 0 rimette la vista, + avvicina
  await tabellone.focus();
  await page.keyboard.press('0');
  await expect(torna).toBeHidden();
  await page.keyboard.press('+');
  await expect(torna).toBeVisible();
  await page.keyboard.press('0');

  // la casella scelta con le frecce ha il cartellino con il nome
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.space-card')).toBeVisible();
  const cartellino = tabellone.locator('.space-tag');
  await expect(cartellino).toBeVisible();
  await expect(cartellino.locator('strong')).not.toBeEmpty();
  await page.keyboard.press('Escape');
  await expect(cartellino).toBeHidden();
  expect(errori).toEqual([]);
});
