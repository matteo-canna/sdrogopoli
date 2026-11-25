// Tipo di partita "Festa": eventi di quartiere a ogni giro e Ruota del Mercato ogni cinque.
import { expect, test } from '@playwright/test';
import { apri, giocaUnPasso, stato } from './aiuti';

test('la partita Festa mostra evento e mercato e li ricorda', async ({ page }, info) => {
  test.skip(info.project.name === 'telefono', 'basta il computer');
  const errori: string[] = [];
  page.on('pageerror', (e) => errori.push(e.message));
  await apri(page, { 'sdrogopoli-vista': '2d', 'sdrogopoli-velocita': 'istantanea' });
  const form = page.locator('#setup-form');

  // scegliendo "Festa" le due regole della casa si accendono da sole
  await form.locator('input[name=preset][value=festa]').check();
  await form.locator('details.house-rules > summary').click();
  await expect(form.locator('input[name=events]')).toBeChecked();
  await expect(form.locator('input[name=wheel]')).toBeChecked();

  await form.locator('input[name=p1]').fill('Bea');
  await form.locator('button[type=submit]').click();
  await page.locator('.game').waitFor();

  // dal primo giro c'è un evento di quartiere e la ruota ha già girato
  await expect(page.locator('.board .events .ev')).toHaveCount(2);
  const s1 = await stato(page);
  expect(s1.event!.round).toBe(1);
  expect(s1.market!.from).toBe(1);
  expect(s1.market!.until).toBe(5);

  // giocando, l'evento cambia a ogni giro e resta sempre uno solo
  for (let i = 0; i < 30; i++) await giocaUnPasso(page);
  const s2 = await stato(page);
  expect(s2.event!.round).toBe(s2.round);
  await expect(page.locator('.board .events .ev')).toHaveCount(2);

  // la partita ripresa conserva evento e mercato
  await page.reload();
  await page.locator('[data-resume]').click();
  const s3 = await stato(page);
  // appena ripresa la partita l'evento è ancora quello di prima; se i computer hanno già
  // fatto scattare il giro successivo, basta che l'evento sia quello del giro corrente
  expect(s3.event, 'evento perso nella ripresa').toBeTruthy();
  expect(s3.market).toBeTruthy();
  if (s3.round === s2.round) expect(s3.event!.id).toBe(s2.event!.id);
  else expect(s3.event!.round).toBe(s3.round);
  expect(errori).toEqual([]);
});

test('senza la regola non compare niente', async ({ page }, info) => {
  test.skip(info.project.name === 'telefono', 'basta il computer');
  await apri(page, { 'sdrogopoli-vista': '2d', 'sdrogopoli-velocita': 'istantanea' });
  await page.click('#setup-form button[type=submit]');
  await page.locator('.game').waitFor();
  await expect(page.locator('.events')).toHaveCount(0);
});
