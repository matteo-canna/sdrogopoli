// Salvare una copia con un nome, esportarla in un file e riaprirla.
import { expect, test } from '@playwright/test';
import { apri, giocaUnPasso, nuovaPartita, stato } from './aiuti';

test('salva, esporta, elimina e reimporta una partita', async ({ page }) => {
  await apri(page, { 'sdrogopoli-vista': '2d', 'sdrogopoli-velocita': 'istantanea' });
  await nuovaPartita(page);
  for (let i = 0; i < 6; i++) await giocaUnPasso(page);
  const giro = (await stato(page)).round;
  await page.click('.slots-box summary');
  await page.fill('#slot-name', 'Prova di Matteo');
  await page.click('.slot-form button[type=submit]');
  await expect(page.locator('.slots-box .slot-msg')).toContainText('Salvata');
  // il nome scritto dà il nome al file
  await page.fill('#slot-name', 'Prova di Matteo');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-action=exportGame]')]);
  expect(download.suggestedFilename()).toBe('prova-di-matteo.sdrogo');
  const path = await download.path();

  // schermata iniziale: la copia è in elenco e si apre
  await page.click('[data-action=quit]');
  await page.click('[data-action=quit]');
  await expect(page.locator('.slot')).toContainText('Prova di Matteo');
  await page.click('[data-slot-load]');
  await expect(page.locator('.board')).toBeVisible();
  expect((await stato(page)).round).toBe(giro);

  // eliminata la copia, il file esportato riporta la stessa partita
  await page.click('[data-action=quit]');
  await page.click('[data-action=quit]');
  await page.click('[data-slot-delete]');
  await page.click('[data-slot-delete]');
  await expect(page.locator('.slot')).toHaveCount(0);
  await page.setInputFiles('[data-import]', path);
  await expect(page.locator('.board')).toBeVisible();
  expect((await stato(page)).round).toBe(giro);
});
