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
