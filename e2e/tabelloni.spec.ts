// Secondo tabellone: si scegliere prima di iniziare, il 2D lo disegna della misura giusta
// e la partita salvata riprende sullo stesso tabellone.
import { expect, test } from '@playwright/test';
import { apri, giocaUnPasso, stato } from './aiuti';

test('si gioca sul tabellone corto e la partita riprende su quello', async ({ page }, info) => {
  test.skip(info.project.name === 'telefono', 'basta il computer');
  const errori: string[] = [];
  page.on('pageerror', (e) => errori.push(e.message));
  await apri(page, { 'sdrogopoli-vista': '2d', 'sdrogopoli-velocita': 'istantanea' });
  const form = page.locator('#setup-form');
  await expect(form.locator('fieldset.boards')).toBeVisible();

  // il tabellone grande è quello proposto
  await expect(form.locator('input[name=board][value=citta]')).toBeChecked();
  await form.locator('details.house-rules > summary').click();
  await expect(form.locator('[data-board-props]')).toHaveText('22');

  // scegliendo la valle cambia anche il numero di vie in vendita
  await form.locator('input[name=board][value=valle]').check();
  await expect(form.locator('[data-board-props]')).toHaveText('15');

  await form.locator('input[name=p1]').fill('Bea');
  await form.locator('button[type=submit]').click();
  await page.locator('.game').waitFor();

  // il tabellone ha 28 caselle e la griglia è di 8 per lato
  await expect(page.locator('.space')).toHaveCount(28);
  await expect(page.locator('.board')).toHaveAttribute('style', /--cells:8/);
  expect(await page.locator('.board .center').getAttribute('style')).toContain('grid-row:2 / 8');

  // qualche mossa, poi si ricarica: la partita riprende sulla valle
  for (let i = 0; i < 12; i++) await giocaUnPasso(page);
  expect((await stato(page)).round).toBeGreaterThanOrEqual(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sdrogopoli-partita') ?? '{}').board)).toBe('valle');

  await page.reload();
  await page.locator('[data-resume]').click();
  await expect(page.locator('.space')).toHaveCount(28);
  expect(errori).toEqual([]);
});

test('tornando al tabellone grande le caselle sono 40', async ({ page }, info) => {
  test.skip(info.project.name === 'telefono', 'basta il computer');
  await apri(page, { 'sdrogopoli-vista': '2d', 'sdrogopoli-velocita': 'istantanea', 'sdrogopoli-tabellone': 'valle' });
  const form = page.locator('#setup-form');
  // l'ultimo tabellone usato è quello già scelto
  await expect(form.locator('input[name=board][value=valle]')).toBeChecked();
  await form.locator('input[name=board][value=citta]').check();
  await form.locator('input[name=p1]').fill('Bea');
  await form.locator('button[type=submit]').click();
  await page.locator('.game').waitFor();
  await expect(page.locator('.space')).toHaveCount(40);
  await expect(page.locator('.board')).toHaveAttribute('style', /--cells:11/);
});
