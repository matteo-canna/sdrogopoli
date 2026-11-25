// Squadre 2 contro 2: si attivano dalle regole della casa e si vedono nelle schede dei giocatori.
import { expect, test } from '@playwright/test';
import { apri, giocaUnPasso, stato } from './aiuti';

test('la partita a squadre parte e mostra le squadre', async ({ page }, info) => {
  test.skip(info.project.name === 'telefono', 'basta il computer');
  const errori: string[] = [];
  page.on('pageerror', (e) => errori.push(e.message));
  await apri(page, { 'sdrogopoli-vista': '2d', 'sdrogopoli-velocita': 'istantanea' });
  const form = page.locator('#setup-form');
  await form.locator('details.house-rules > summary').click();
  await form.locator('input[name=teams]').check();
  // con due soli giocatori le squadre non si possono fare: lo dice e non parte
  await form.locator('button[type=submit]').click();
  await expect(form.locator('.error')).toBeVisible();
  await expect(page.locator('.game')).toHaveCount(0);

  // con quattro giocatori parte
  await form.locator('input[name=p2]').fill('Carla');
  await form.locator('input[name=p3]').fill('Dario');
  await form.locator('button[type=submit]').click();
  await page.locator('.game').waitFor();
  await expect(page.locator('.player .badge.team').first()).toContainText('Squadra');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sdrogopoli-partita') ?? '{}').state.players.map((p: { team: number }) => p.team))).toEqual([0, 1, 0, 1]);

  // qualche mossa: nessun errore e le squadre restano
  for (let i = 0; i < 25; i++) await giocaUnPasso(page);
  expect((await stato(page)).round).toBeGreaterThanOrEqual(1);
  expect(errori).toEqual([]);
});
