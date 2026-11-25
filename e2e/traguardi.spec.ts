// Traguardi: a fine partita si sbloccano, si vedono nel riepilogo e restano nella schermata iniziale.
import { expect, test } from '@playwright/test';
import { apri, giocaUnPasso, nuovaPartita, stato } from './aiuti';

test('i traguardi si sbloccano a fine partita e restano', async ({ page }, info) => {
  test.skip(info.project.name === 'telefono', 'basta il computer');
  const errori: string[] = [];
  page.on('pageerror', (e) => errori.push(e.message));
  await apri(page, { 'sdrogopoli-vista': '2d', 'sdrogopoli-velocita': 'istantanea' });
  // nella schermata iniziale i traguardi sono tutti da raggiungere
  await expect(page.locator('.goals summary')).toContainText('0 su 30');
  // tipo di partita "Breve": 15 giri e poi vince chi ha il patrimonio più alto
  await page.check('input[name=preset][value=breve]');
  await nuovaPartita(page);
  await expect
    .poll(
      async () => {
        await giocaUnPasso(page);
        return (await stato(page)).phase === 'gameOver';
      },
      { timeout: 200_000, intervals: [100] },
    )
    .toBe(true);
  // il riepilogo mostra i traguardi appena raggiunti
  await expect(page.locator('.new-goals li').first()).toBeVisible();
  const sbloccati = await page.evaluate(() => JSON.parse(localStorage.getItem('sdrogopoli-profilo') ?? '{}'));
  expect(sbloccati.unlocked).toContain('prima-partita');
  expect(sbloccati.profile.games).toBe(1);

  // tornando alla schermata iniziale il conto è aggiornato e il titolo si può scegliere
  await page.reload();
  await expect(page.locator('.goals summary')).not.toContainText('0 su 30');
  await page.locator('.goals summary').click();
  await page.selectOption('.goals [data-title]', 'prima-partita');
  await page.reload();
  await page.locator('.goals summary').click();
  await expect(page.locator('.goals [data-title]')).toHaveValue('prima-partita');

  // il profilo si esporta in un file e si reimporta sommandosi a quello che c'è
  const scarico = page.waitForEvent('download');
  await page.click('[data-profile-export]');
  const file = await (await scarico).path();
  await page.setInputFiles('[data-profile-import]', file);
  await expect(page.locator('[data-profile-msg]')).toContainText('Profilo importato');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sdrogopoli-profilo') ?? '{}').profile.games)).toBe(2);
  expect(errori).toEqual([]);
});
