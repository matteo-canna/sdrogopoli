// Memoria del 3D: tanti passaggi tra 2D e 3D e tre partite di fila senza perdere la grafica.
import { expect, test } from '@playwright/test';
import { apri, nuovaPartita } from './aiuti';

test('10 passaggi 2D/3D e 3 partite senza contesti WebGL persi', async ({ page }) => {
  const avvisi: string[] = [];
  page.on('console', (m) => {
    const t = m.text();
    // "GPU stall due to ReadPixels" è un avviso di prestazioni del driver software dei test, non un problema
    if (/webgl|context/i.test(t) && !/ReadPixels/.test(t)) avvisi.push(t);
  });
  page.on('pageerror', (e) => avvisi.push(e.message));
  await apri(page, { 'sdrogopoli-vista': '3d', 'sdrogopoli-velocita': 'istantanea' });
  for (let partita = 0; partita < 3; partita++) {
    await nuovaPartita(page);
    await expect(page.locator('.board3d canvas')).toBeVisible();
    if (partita === 0) {
      for (let i = 0; i < 10; i++) {
        await page.click('[data-action=toggleView]');
        await expect(page.locator(i % 2 === 0 ? '.board' : '.board3d canvas')).toBeVisible();
      }
    }
    // si torna alla schermata iniziale per la partita dopo (abbandonare chiede conferma)
    await page.click('[data-action=quit]');
    await page.click('[data-action=quit]');
    await page.locator('#setup-form').waitFor();
    const nuova = page.locator('[data-new-game]');
    if (await nuova.count()) await nuova.click();
  }
  expect(avvisi).toEqual([]);
  // un solo contesto WebGL vivo alla volta: nella schermata iniziale non ne restano
  expect(await page.locator('canvas').count()).toBeLessThanOrEqual(1);
});
