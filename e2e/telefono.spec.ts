// Sul telefono: il pulsante principale si vede tutto e i controlli sono alti almeno 44 px.
import { expect, test } from '@playwright/test';
import { apri, nuovaPartita } from './aiuti';

for (const vista of ['2d', '3d']) {
  test(`controlli comodi da toccare, vista ${vista}`, async ({ page }) => {
    await apri(page, { 'sdrogopoli-vista': vista, 'sdrogopoli-velocita': 'istantanea' });
    await nuovaPartita(page);
    const principale = page.locator('.actions button.primary').first();
    await expect(principale).toBeInViewport({ ratio: 1 });
    const piccoli = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('button, a, input, select, summary')]
        // le caselle del tabellone 2D si raggiungono anche dalle schede dei giocatori
        .filter((el) => el.offsetParent !== null && !el.classList.contains('space'))
        .map((el) => ({ el: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 40), r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && (r.width < 44 || r.height < 44))
        .map(({ el, r }) => `${el} ${Math.round(r.width)}×${Math.round(r.height)}`),
    );
    expect(piccoli).toEqual([]);
  });
}

test('la scelta della pedina si apre sopra la pagina ed è comoda da toccare', async ({ page }) => {
  await apri(page, { 'sdrogopoli-vista': '2d' });
  // il pulsante per iniziare è sempre a portata, in fondo allo schermo
  await expect(page.locator('#setup-form button[type=submit]')).toBeInViewport({ ratio: 1 });
  await page.click('[data-look="0"]');
  const finestra = page.locator('.look-dialog');
  await expect(finestra).toBeVisible();
  await expect(finestra.locator('[data-look-done]')).toBeInViewport({ ratio: 1 });
  // una pedina di un altro reparto, scelta toccando la tessera
  await finestra.locator('[data-look-family=veicoli]').click();
  await finestra.locator('[data-character=vespa]').click();
  await expect(finestra.locator('[data-character=vespa]')).toHaveAttribute('aria-checked', 'true');
  const piccoli = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.look-dialog button')]
      .filter((el) => el.offsetParent !== null)
      .map((el) => ({ el: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30), r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width < 44 || r.height < 44)
      .map(({ el, r }) => `${el} ${Math.round(r.width)}×${Math.round(r.height)}`),
  );
  expect(piccoli).toEqual([]);
  await finestra.locator('[data-look-done]').click();
  await expect(finestra).toBeHidden();
  // il posto mostra la pedina nuova e il focus torna lì
  await expect(page.locator('[data-look="0"]')).toContainText('🛵');
  await expect(page.locator('[data-look="0"]')).toBeFocused();
});
