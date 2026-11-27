// Una partita vera nel browser: una persona e tre computer arrivano al giro 20 (o alla fine) senza errori.
import { expect, test } from '@playwright/test';
import { apri, giocaUnPasso, nuovaPartita, stato } from './aiuti';

for (const vista of ['2d', '3d']) {
  test(`partita 1 persona + 3 computer fino al giro 20, vista ${vista}`, async ({ page }) => {
    // il 3D ora occupa tutta la finestra: in CI, senza scheda grafica, ogni fotogramma costa di più
    if (vista === '3d') test.setTimeout(420_000);
    const errori: string[] = [];
    page.on('pageerror', (e) => errori.push(e.message));
    await apri(page, { 'sdrogopoli-vista': vista, 'sdrogopoli-velocita': 'istantanea' });
    await nuovaPartita(page);
    const giri = vista === '2d' ? 20 : 10;
    await expect
      .poll(
        async () => {
          await giocaUnPasso(page);
          const s = await stato(page);
          return s.phase === 'gameOver' || s.round >= giri;
        },
        { timeout: vista === '3d' ? 380_000 : 200_000, intervals: [100] },
      )
      .toBe(true);
    expect(errori).toEqual([]);
    // in 20 giri qualcuno ha pagato o incassato: gli avvisi brevi sono comparsi
    await expect(page.locator('#avvisi')).toBeAttached();
    // ricaricando si riprende la stessa partita
    const prima = await stato(page);
    await page.reload();
    await page.click('[data-resume]');
    await expect(page.locator('.game')).toBeVisible();
    expect((await stato(page)).round).toBe(prima.round);
  });
}

test('rivincita a fine partita: riparte con ordine invertito rispetto alla classifica e aggiorna la classifica tra amici', async ({ page }) => {
  await apri(page, { 'sdrogopoli-vista': '2d', 'sdrogopoli-velocita': 'istantanea' });
  // Partita breve (15 giri) per arrivare subito a fine partita
  await page.locator('input[name=preset][value=breve]').check();
  await nuovaPartita(page);
  await expect
    .poll(
      async () => {
        const s = await stato(page);
        if (s.phase === 'gameOver') return true;
        await giocaUnPasso(page);
        return (await stato(page)).phase === 'gameOver';
      },
      { timeout: 180_000, intervals: [50] },
    )
    .toBe(true);

  const finePrima = await stato(page);
  const ultimoPosto = await page.locator('.summary .standings li').last().locator('strong').textContent();
  const pulsanteRivincita = page.locator('[data-action=rematch]');
  await expect(pulsanteRivincita).toBeVisible();
  await pulsanteRivincita.click();

  const seconda = await stato(page);
  expect(seconda.phase).not.toBe('gameOver');
  expect(seconda.round).toBe(1);
  expect((seconda as unknown as { seed: number }).seed).not.toBe((finePrima as unknown as { seed: number }).seed);
  // chi era ultimo nella classifica finale ora parte per primo
  const primoNuovo = (seconda.players as unknown as { name: string }[])[0].name;
  expect(ultimoPosto?.replace('🤖 ', '').trim()).toBe(primoNuovo);
});
