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
