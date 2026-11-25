// Accessibilità con axe: nessun errore grave o critico nelle schermate principali.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { apri, nuovaPartita } from './aiuti';

async function erroriGravi(page: Page): Promise<string[]> {
  const r = await new AxeBuilder({ page }).analyze();
  return r.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')})`);
}

for (const tema of ['light', 'dark'] as const) {
  test(`schermate senza errori gravi, tema ${tema}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: 'reduce' });
    await apri(page, { 'sdrogopoli-vista': '2d', 'sdrogopoli-velocita': 'istantanea' });
    expect(await erroriGravi(page), 'schermata iniziale').toEqual([]);
    // la finestra di scelta della pedina, con una statuetta (che ha più scelte)
    await page.click('[data-look="0"]');
    await page.locator('.look-dialog [data-look-family=personaggi]').click();
    await page.locator('.look-dialog [data-character=char_samurai]').click();
    expect(await erroriGravi(page), 'scelta della pedina').toEqual([]);
    // con le frecce si passa alla pedina vicina; Esc chiude e il focus torna sul posto
    await page.locator('.look-dialog [data-character=char_samurai]').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.look-dialog [data-character=char_diver]')).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');
    await expect(page.locator('.look-dialog')).toBeHidden();
    await expect(page.locator('[data-look="0"]')).toBeFocused();
    await nuovaPartita(page);
    expect(await erroriGravi(page), 'partita 2D').toEqual([]);
    await page.click('[data-space="periferia-1"]');
    await expect(page.locator('.space-card')).toBeVisible();
    expect(await erroriGravi(page), 'carta della casella').toEqual([]);
  });
}
