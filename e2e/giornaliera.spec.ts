// Partita del giorno: stesso seme per tutti, risultato ricordato e riassunto da copiare.
import { expect, test } from '@playwright/test';
import { apri, giocaUnPasso, stato } from './aiuti';

test('la partita del giorno si gioca e lascia il risultato', async ({ page }, info) => {
  test.skip(info.project.name === 'telefono', 'basta il computer');
  const errori: string[] = [];
  page.on('pageerror', (e) => errori.push(e.message));
  await apri(page, { 'sdrogopoli-vista': '2d', 'sdrogopoli-velocita': 'istantanea' });
  const riquadro = page.locator('.daily-card');
  await expect(riquadro).toContainText('Partita del giorno');
  await riquadro.locator('[data-daily-play]').click();
  await page.locator('.game').waitFor();
  // è una partita di 15 giri con tre computer
  const s = await stato(page);
  expect(s.players).toHaveLength(4);
  const semeUno = await page.evaluate(() => JSON.parse(localStorage.getItem('sdrogopoli-partita') ?? '{}').state.seed);

  await expect
    .poll(
      async () => {
        await giocaUnPasso(page);
        return (await stato(page)).phase === 'gameOver';
      },
      { timeout: 200_000, intervals: [100] },
    )
    .toBe(true);
  const risultato = await page.evaluate(() => JSON.parse(localStorage.getItem('sdrogopoli-partita-del-giorno') ?? 'null'));
  expect(risultato.players).toBe(4);
  expect(risultato.place).toBeGreaterThanOrEqual(1);

  // tornando alla schermata iniziale il risultato di oggi è lì, e il seme non cambia
  await page.reload();
  await expect(page.locator('.daily-result')).toContainText('Oggi:');
  await page.locator('[data-daily-play]').click();
  await page.locator('.game').waitFor();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sdrogopoli-partita') ?? '{}').state.seed)).toBe(semeUno);
  expect(errori).toEqual([]);
});
